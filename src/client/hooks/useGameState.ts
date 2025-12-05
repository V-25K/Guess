/**
 * useGameState Hook
 * Manages game state including challenges, navigation, and preloading.
 * Extracted from main.tsx to improve code organization and reusability.
 * 
 * This hook handles:
 * - Challenge list management (all challenges vs available)
 * - Current challenge index and navigation
 * - Specific challenge viewing mode
 * - Challenge preloading coordination
 */

import { useState } from '@devvit/public-api';
import type { GameChallenge } from '../../shared/models/challenge.types.js';
import type { ChallengeAttempt } from '../../shared/models/attempt.types.js';
import { filterAvailableChallenges } from '../../shared/utils/challenge-utils.js';
import type { PreloadService } from '../../server/services/preload.service.js';
import type { AttemptService } from '../../server/services/attempt.service.js';

export interface GameStateOptions {
    userId: string;
    preloadService: PreloadService;
    attemptService: AttemptService;
    onPreload?: (challenge: GameChallenge) => Promise<{ avatarUrl?: string }>;
}

export interface GameState {
    // Challenge data
    challenges: GameChallenge[];
    availableChallenges: GameChallenge[];
    currentChallengeIndex: number;
    currentChallenge: GameChallenge | null;

    // State flags
    isViewingSpecificChallenge: boolean;
    challengesLoaded: boolean;
    isLoadingNext: boolean;

    // Actions
    setChallenges: (challenges: GameChallenge[]) => void;
    setAvailableChallenges: (challenges: GameChallenge[]) => void;
    setChallengesLoaded: (loaded: boolean) => void;
    setCurrentChallengeIndex: (index: number) => void;
    setIsViewingSpecificChallenge: (viewing: boolean) => void;
    handleNextChallenge: () => Promise<void>;
    refreshAvailableChallenges: () => Promise<void>;
}

export function useGameState(options: GameStateOptions): GameState {
    const { userId, preloadService, attemptService, onPreload } = options;

    // Challenge state
    const [challenges, setChallenges] = useState<GameChallenge[]>([]);
    const [availableChallenges, setAvailableChallenges] = useState<GameChallenge[]>([]);
    const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
    const [isViewingSpecificChallenge, setIsViewingSpecificChallenge] = useState(false);
    const [challengesLoaded, setChallengesLoaded] = useState(false);
    const [isLoadingNext, setIsLoadingNext] = useState(false);

    // Calculate current challenge based on viewing mode
    const activeChallenges = isViewingSpecificChallenge ? challenges : availableChallenges;
    const currentChallenge = activeChallenges[currentChallengeIndex] || null;

    // Preload next challenges helper
    const triggerPreload = async (index: number, challengeList: GameChallenge[]) => {
        if (challengeList.length > 0 && onPreload) {
            preloadService.preloadNextChallenges(
                index,
                challengeList,
                onPreload
            );
        }
    };

    // Refresh available challenges from current challenges list
    const refreshAvailableChallenges = async () => {
        try {
            const userAttempts = await attemptService.getUserAttempts(userId);
            const available = filterAvailableChallenges(challenges, userAttempts, userId);
            setAvailableChallenges(available);
            setCurrentChallengeIndex(0);

            // Trigger preload for new available challenges
            await triggerPreload(0, available);
        } catch (error) {
            console.error('[useGameState] Error refreshing available challenges:', error);
        }
    };

    // Handle moving to next challenge
    const handleNextChallenge = async () => {
        try {
            setIsLoadingNext(true);

            if (isViewingSpecificChallenge) {
                // When viewing a specific challenge, switch to browsing mode
                setIsViewingSpecificChallenge(false);
                setCurrentChallengeIndex(0);
                setIsLoadingNext(false);
                return;
            }

            const nextIndex = currentChallengeIndex + 1;

            // Move to next available challenge if it exists
            if (nextIndex < availableChallenges.length && availableChallenges[nextIndex]) {
                const nextChallenge = availableChallenges[nextIndex];
                const preloaded = preloadService.getPreloadedChallenge(nextChallenge.id);

                // Use preloaded avatar URL if available
                if (preloaded?.avatarUrl && !nextChallenge.creator_avatar_url) {
                    nextChallenge.creator_avatar_url = preloaded.avatarUrl;
                }

                setCurrentChallengeIndex(nextIndex);

                // Trigger preload for subsequent challenges
                await triggerPreload(nextIndex, availableChallenges);

                setIsLoadingNext(false);
            } else {
                // Refresh available challenges to check for new ones
                await refreshAvailableChallenges();
                setIsLoadingNext(false);
            }
        } catch (error) {
            console.error('[useGameState] Error in handleNextChallenge:', error);
            setIsLoadingNext(false);
        }
    };

    return {
        // State
        challenges,
        availableChallenges,
        currentChallengeIndex,
        currentChallenge,
        isViewingSpecificChallenge,
        challengesLoaded,
        isLoadingNext,

        // Actions
        setChallenges,
        setAvailableChallenges,
        setChallengesLoaded,
        setCurrentChallengeIndex,
        setIsViewingSpecificChallenge,
        handleNextChallenge,
        refreshAvailableChallenges,
    };
}
