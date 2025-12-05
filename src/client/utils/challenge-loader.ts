/**
 * Challenge Loader Utility
 * Encapsulates logic for fetching challenges, user attempts, and related data.
 * Handles avatar preloading and available challenge filtering.
 */

import type { Context } from '@devvit/public-api';
import type { ChallengeService } from '../../server/services/challenge.service.js';
import type { AttemptService } from '../../server/services/attempt.service.js';
import type { UserService } from '../../server/services/user.service.js';
import type { GameChallenge } from '../../shared/models/challenge.types.js';
import { convertToGameChallenges, filterAvailableChallenges } from '../../shared/utils/challenge-utils.js';
import { fetchAvatarUrlCached } from '../../server/utils/challenge-utils.js';

export interface ChallengeLoadResult {
    allChallenges: GameChallenge[];
    availableChallenges: GameChallenge[];
    isMember: boolean;
    canCreateChallenge: boolean;
    rateLimitTimeRemaining: number;
}

export interface ChallengeLoaderServices {
    challengeService: ChallengeService;
    attemptService: AttemptService;
    userService: UserService;
}

/**
 * Loads challenges with avatar URLs and handles preloading
 */
export async function loadChallengesWithAvatars(
    context: Context,
    userId: string,
    services: ChallengeLoaderServices
): Promise<ChallengeLoadResult> {
    try {
        // Parallel fetch of subscription status and rate limit check (Requirement 5.1)
        const [subscriptionResult, rateLimitCheck, dbChallenges, userAttempts] = await Promise.all([
            // Check if user has subscribed (tracked in Redis)
            (async () => {
                try {
                    const subscriptionKey = `subscription:${userId}`;
                    const isSubscribed = await context.redis.get(subscriptionKey);
                    return isSubscribed === 'true';
                } catch {
                    return false;
                }
            })(),
            // Check rate limit
            services.userService.canCreateChallenge(userId),
            // Fetch challenges
            services.challengeService.getChallenges(),
            // OPTIMIZATION: Batch fetch all user attempts in single query (Requirement 5.2)
            services.attemptService.getUserAttempts(userId),
        ]);

        const gameChallenges = convertToGameChallenges(dbChallenges);

        // Fetch avatars using cached version (Requirement 5.3)
        await Promise.all(
            gameChallenges.map(async (challenge) => {
                try {
                    const avatarUrl = await fetchAvatarUrlCached(context, challenge.creator_username);
                    if (avatarUrl) {
                        challenge.creator_avatar_url = avatarUrl;
                    }
                } catch (error) {
                    console.error('[ChallengeLoader] Error fetching avatar:', error);
                }
            })
        );

        // Filter out completed, game over, or user's own challenges
        const available = filterAvailableChallenges(gameChallenges, userAttempts, userId);

        return {
            allChallenges: gameChallenges,
            availableChallenges: available,
            isMember: subscriptionResult,
            canCreateChallenge: rateLimitCheck.canCreate,
            rateLimitTimeRemaining: rateLimitCheck.timeRemaining,
        };
    } catch (error) {
        console.error('[ChallengeLoader] Error loading challenges:', error);
        throw error;
    }
}
