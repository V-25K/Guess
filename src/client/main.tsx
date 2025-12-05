/**
 * Main Application Entry Point
 * Refactored to use service layer architecture with dependency injection
 */

import {
    Devvit,
    useState,
    useAsync,
} from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

import { UserService } from '../server/services/user.service.js';
import { ChallengeService } from '../server/services/challenge.service.js';
import { AttemptService } from '../server/services/attempt.service.js';
import { LeaderboardService } from '../server/services/leaderboard.service.js';
import { CommentService } from '../server/services/comment.service.js';
import { PreloadService } from '../server/services/preload.service.js';
import { CacheService } from '../server/services/cache.service.js';

import { UserRepository } from '../server/repositories/user.repository.js';
import { ChallengeRepository } from '../server/repositories/challenge.repository.js';
import { AttemptRepository } from '../server/repositories/attempt.repository.js';
import { CommentRepository } from '../server/repositories/comment.repository.js';

import { RequestDeduplicator, createDedupeKey } from '../shared/utils/request-deduplication.js';

import { useNavigation } from './hooks/useNavigation.js';
import { useRewards } from './hooks/useRewards.js';

import { NavigationBar, ViewContainer } from './components/navigation/index.js';
import { ErrorBoundary, LoadingView, AllCaughtUpView, ViewRouter } from './components/shared/index.js';
import { RewardNotification } from './components/shared/RewardNotification.js';

import { convertToGameChallenges, filterAvailableChallenges } from '../shared/utils/challenge-utils.js';
import { fetchAvatarUrlCached } from '../server/utils/challenge-utils.js';
import { loadChallengesWithAvatars } from './utils/challenge-loader.js';

import { BG_PRIMARY } from './constants/colors.js';

import type { GameChallenge, Challenge } from '../shared/models/challenge.types.js';
import type { UserProfile } from '../shared/models/user.types.js';
import type { PaginatedLeaderboardResult } from '../server/services/leaderboard.service.js';

/**
 * Initialize all services with dependency injection
 * This creates the service layer that handles all business logic
 * Accepts both Context and TriggerContext types
 */
function initializeServices(context: Context) {
    const userRepo = new UserRepository(context);
    const challengeRepo = new ChallengeRepository(context);
    const attemptRepo = new AttemptRepository(context);
    const commentRepo = new CommentRepository(context);

    const userService = new UserService(context, userRepo);
    const challengeService = new ChallengeService(context, challengeRepo, userService);
    const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);
    const leaderboardService = new LeaderboardService(context, userRepo);
    const commentService = new CommentService(context, commentRepo, userService);

    // Performance optimization services
    const preloadService = new PreloadService();
    const cacheService = new CacheService(context);
    const requestDeduplicator = new RequestDeduplicator();

    return {
        userService,
        challengeService,
        attemptService,
        leaderboardService,
        commentService,
        preloadService,
        cacheService,
        requestDeduplicator,
    };
}

const GuessTheLinkGame: Devvit.CustomPostComponent = (context: Context) => {
    const services = initializeServices(context);

    const { data: currentUser, error: userError, loading: userLoading } = useAsync<{ id: string; username: string } | null>(async () => {
        try {
            const user = await context.reddit.getCurrentUser();

            // Strict validation - user must have both id and username
            if (!user || !user.id || !user.username) {
                console.error('[Main] Authentication failed - missing user data:', {
                    hasUser: !!user,
                    hasId: !!user?.id,
                    hasUsername: !!user?.username
                });
                return null;
            }

            return {
                id: user.id,
                username: user.username
            };
        } catch (error) {
            console.error('[Main] Authentication error:', error);
            return null;
        }
    });

    // Show loading while checking authentication
    if (userLoading) {
        return <LoadingView />;
    }

    // Handle user authentication errors or missing user
    if (userError || !currentUser) {
        return (
            <vstack alignment="center middle" padding="large" gap="large" width="100%" height="100%" backgroundColor={BG_PRIMARY}>
                <image
                    url="logo.png"
                    imageHeight={100}
                    imageWidth={240}
                    resizeMode="fit"
                />
                <vstack gap="small" alignment="center middle">
                    <text size="xlarge">🔒</text>
                    <text size="large" weight="bold" color="#1c1c1c">Authentication Required</text>
                    <text size="medium" color="#878a8c" alignment="center">
                        You must be logged in to Reddit to play this game.
                    </text>
                    <text size="small" color="#878a8c" alignment="center">
                        Please log in and refresh the page.
                    </text>
                </vstack>
            </vstack>
        );
    }

    // At this point, currentUser is guaranteed to have id and username
    const userId = currentUser.id;
    const username = currentUser.username;

    // Check if this post has a specific challenge to open
    const postData = context.postData as { challengeId?: string; openDirectly?: boolean } | undefined;
    const shouldOpenChallenge = postData?.openDirectly && postData?.challengeId;

    const { currentView, navigateTo } = useNavigation('loading');
    const { currentReward, showReward, dismissReward } = useRewards();

    const [challenges, setChallenges] = useState<GameChallenge[]>([]);
    const [availableChallenges, setAvailableChallenges] = useState<GameChallenge[]>([]);
    const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
    const [isViewingSpecificChallenge, setIsViewingSpecificChallenge] = useState(false);
    const [challengesLoaded, setChallengesLoaded] = useState(false);

    const [canCreateChallenge, setCanCreateChallenge] = useState(true);
    const [rateLimitTimeRemaining, setRateLimitTimeRemaining] = useState(0);
    const [isMember, setIsMember] = useState(false);

    const { data: subredditName } = useAsync(async () => {
        const sub = await context.reddit.getCurrentSubreddit();
        return sub.name;
    });
    const [userLevel, setUserLevel] = useState(0);
    const [isModerator, setIsModerator] = useState(false);

    // Client-side cache for instant page loads (stale-while-revalidate pattern)
    const [cachedProfile, setCachedProfile] = useState<UserProfile | null>(null);
    const [cachedLeaderboard, setCachedLeaderboard] = useState<PaginatedLeaderboardResult | null>(null);
    const [cachedAvatarUrl, setCachedAvatarUrl] = useState<string | null>(null);
    // Awards uses the same profile data, so cachedProfile serves both ProfileView and AwardsView

    // Load user profile separately to ensure state updates work
    // Uses request deduplication to prevent duplicate fetches (Requirement 4.3)
    const { } = useAsync(async () => {
        if (!currentUser) return null;

        // Deduplicate profile requests using RequestDeduplicator
        const dedupeKey = createDedupeKey('profile', userId);
        const profile = await services.requestDeduplicator.dedupe(dedupeKey, () =>
            services.userService.getUserProfile(userId, username)
        );
        return profile;
    }, {
        depends: [userId],
        finally: (profile) => {
            if (profile) {
                setUserLevel(profile.level);
                const isMod = profile.role === 'mod';
                setIsModerator(isMod);
            }
        }
    });

    useAsync<{
        allChallenges: GameChallenge[];
        availableChallenges: GameChallenge[];
    }>(async () => {
        if (!currentUser) return { allChallenges: [], availableChallenges: [] };

        try {
            const result = await loadChallengesWithAvatars(context, userId, {
                challengeService: services.challengeService,
                attemptService: services.attemptService,
                userService: services.userService,
            });

            setIsMember(result.isMember);
            setCanCreateChallenge(result.canCreateChallenge);
            setRateLimitTimeRemaining(result.rateLimitTimeRemaining);

            return {
                allChallenges: result.allChallenges,
                availableChallenges: result.availableChallenges
            };
        } catch (error) {
            console.error('[Main] Error loading challenges:', error);
            return { allChallenges: [], availableChallenges: [] };
        }
    }, {
        depends: [userId],
        finally: (data) => {
            if (data) {
                setChallenges(data.allChallenges);
                setAvailableChallenges(data.availableChallenges);
                setChallengesLoaded(true);

                // Trigger preload of next challenges after current loads (Requirement 2.1, 2.2)
                if (data.availableChallenges.length > 0) {
                    services.preloadService.preloadNextChallenges(
                        currentChallengeIndex,
                        data.availableChallenges,
                        async (challenge) => {
                            // Fetch avatar URL for preloaded challenges
                            const avatarUrl = await fetchAvatarUrlCached(context, challenge.creator_username || '');
                            return { avatarUrl };
                        }
                    );
                }

                // If this post should open a specific challenge, find and set it
                if (shouldOpenChallenge && postData?.challengeId && data.allChallenges.length > 0) {
                    const challengeIndex = data.allChallenges.findIndex(c => c.id === postData.challengeId);
                    if (challengeIndex !== -1) {
                        setCurrentChallengeIndex(challengeIndex);
                        setIsViewingSpecificChallenge(true);
                        navigateTo('gameplay');
                        return;
                    }
                }
            }

            // Only navigate to menu if still on initial loading screen
            // Don't navigate if user has already navigated elsewhere (e.g., clicked Play)
            if (currentView === 'loading') {
                navigateTo('menu');
            }
        }
    });

    // Use full challenges list if viewing specific challenge, otherwise use available challenges
    const activeChallenges = isViewingSpecificChallenge ? challenges : availableChallenges;
    const currentChallenge = activeChallenges[currentChallengeIndex] || null;

    const [isLoadingNext, setIsLoadingNext] = useState(false);

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

            // Validate current index
            const nextIndex = currentChallengeIndex + 1;

            // Move to next available challenge
            if (nextIndex < availableChallenges.length && availableChallenges[nextIndex]) {
                // Check if next challenge is preloaded (Requirement 2.1)
                const nextChallenge = availableChallenges[nextIndex];
                const preloaded = services.preloadService.getPreloadedChallenge(nextChallenge.id);

                if (preloaded?.avatarUrl && !nextChallenge.creator_avatar_url) {
                    // Use preloaded avatar URL
                    nextChallenge.creator_avatar_url = preloaded.avatarUrl;
                }

                setCurrentChallengeIndex(nextIndex);

                // Trigger preload for subsequent challenges (Requirement 2.2)
                services.preloadService.preloadNextChallenges(
                    nextIndex,
                    availableChallenges,
                    async (challenge) => {
                        const avatarUrl = await fetchAvatarUrlCached(context, challenge.creator_username || '');
                        return { avatarUrl };
                    }
                );

                setIsLoadingNext(false);
            } else {
                // Refresh available challenges to check if any new ones are available
                const userAttempts = await services.attemptService.getUserAttempts(userId);
                const available = filterAvailableChallenges(challenges, userAttempts, userId);
                setAvailableChallenges(available);
                setCurrentChallengeIndex(0);

                // Trigger preload for new available challenges
                if (available.length > 0) {
                    services.preloadService.preloadNextChallenges(
                        0,
                        available,
                        async (challenge) => {
                            const avatarUrl = await fetchAvatarUrlCached(context, challenge.creator_username || '');
                            return { avatarUrl };
                        }
                    );
                }

                setIsLoadingNext(false);
            }
        } catch (error) {
            console.error('[Main] Error in handleNextChallenge:', error);
            context.ui.showToast('⚠️ Error loading next challenge');
            setIsLoadingNext(false);
        }
    };


    const handleSubscribe = async () => {
        try {
            // Try to subscribe user to the current subreddit using Reddit API
            await context.reddit.subscribeToCurrentSubreddit();

            // Track subscription in Redis
            const subscriptionKey = `subscription:${userId}`;
            await context.redis.set(subscriptionKey, 'true');

            // Update membership status
            setIsMember(true);
            context.ui.showToast('Successfully subscribed!');
        } catch (error: any) {

            // If permission not granted, navigate to subreddit as fallback
            if (error?.message?.includes('permission not granted')) {
                try {
                    // Navigate to subreddit URL
                    if (subredditName) {
                        context.ui.navigateTo(`https://www.reddit.com/r/${subredditName}`);
                    } else {
                        throw new Error('Subreddit name not available');
                    }

                    // Optimistically mark as subscribed
                    const subscriptionKey = `subscription:${userId}`;
                    await context.redis.set(subscriptionKey, 'true');
                    setIsMember(true);

                    context.ui.showToast('Opening subreddit to subscribe');
                } catch (navError) {
                    console.error('[Main] Error navigating to subreddit:', navError);
                    context.ui.showToast('Please visit r/guess_the_1ink_dev to subscribe');
                }
            } else {
                context.ui.showToast('Failed to subscribe. Please try again.');
            }
        }
    };

    const handleChallengeCreated = async (createdChallenge: any) => {
        // Refresh data in the background while success screen is shown
        try {
            const result = await loadChallengesWithAvatars(context, userId, {
                challengeService: services.challengeService,
                attemptService: services.attemptService,
                userService: services.userService,
            });

            setChallenges(result.allChallenges);
            setAvailableChallenges(result.availableChallenges);
            setCanCreateChallenge(result.canCreateChallenge);
            setRateLimitTimeRemaining(result.rateLimitTimeRemaining);

            // Clear preload cache since challenges have changed
            services.preloadService.clearPreloadCache();

        } catch (error) {
            console.error('[Main] Error refreshing data after challenge creation:', error);
        }
    };

    // Render logic
    const mainContent = (
        <ViewRouter
            currentView={currentView}
            navigateTo={navigateTo}
            userId={userId}
            username={username || ''}
            userLevel={userLevel}
            isModerator={isModerator}
            isMember={isMember}
            challenges={challenges}
            availableChallenges={availableChallenges}
            currentChallenge={currentChallenge}
            currentChallengeIndex={currentChallengeIndex}
            isViewingSpecificChallenge={isViewingSpecificChallenge}
            challengesLoaded={challengesLoaded}
            isLoadingNext={isLoadingNext}
            canCreateChallenge={canCreateChallenge}
            rateLimitTimeRemaining={rateLimitTimeRemaining}
            userService={services.userService}
            challengeService={services.challengeService}
            leaderboardService={services.leaderboardService}
            cachedProfile={cachedProfile}
            setCachedProfile={setCachedProfile}
            cachedLeaderboard={cachedLeaderboard}
            setCachedLeaderboard={setCachedLeaderboard}
            cachedAvatarUrl={cachedAvatarUrl}
            handleNextChallenge={handleNextChallenge}
            handleSubscribe={handleSubscribe}
            handleChallengeCreated={handleChallengeCreated}
            showReward={showReward}
            setIsViewingSpecificChallenge={setIsViewingSpecificChallenge}
        />
    );

    return (
        <zstack width="100%" height="100%" alignment="center middle">
            {mainContent}

            {/* Reward Notification Overlay */}
            {currentReward ? (
                <RewardNotification
                    type={currentReward.type}
                    points={currentReward.points}
                    experience={currentReward.experience}
                    level={currentReward.level}
                    message={currentReward.message}
                    onDismiss={dismissReward}
                />
            ) : null}
        </zstack>
    );
};

// Devvit.configure removed in favor of devvit.json configuration

Devvit.addSettings([
    {
        type: 'string',
        name: 'SUPABASE_URL',
        label: 'Supabase Project URL',
        helpText: 'Your Supabase project URL (e.g., https://xxxxx.supabase.co)',
        scope: 'installation',
    },
    {
        type: 'string',
        name: 'SUPABASE_ANON_KEY',
        label: 'Supabase Anon Key',
        helpText: 'Your Supabase anonymous/public API key',
        scope: 'installation',
    },
    {
        type: 'string',
        name: 'GEMINI_API_KEY',
        label: 'Gemini API Key',
        helpText: 'Your Google Gemini API key for AI judging',
        scope: 'installation',
    },
]);

Devvit.addCustomPostType({
    name: 'Game the Link',
    height: 'tall',
    render: GuessTheLinkGame,
});

Devvit.addTrigger({
    event: 'CommentSubmit',
    onEvent: async (event, context) => {
        try {
            const commentId = event.comment?.id;
            const postId = event.post?.id;
            const authorId = event.author?.id;

            if (!commentId || !postId || !authorId) {
                return;
            }

            const services = initializeServices(context as unknown as Context);
            const challenge = await services.challengeService.getChallengeByPostId(postId);

            if (!challenge) {
                return;
            }

            await services.commentService.trackComment(
                challenge.id,
                commentId,
                authorId,
                challenge.creator_id
            );

        } catch (error) {
            console.error('[Main] Error in CommentSubmit trigger:', error);
        }
    },
});

Devvit.addMenuItem({
    label: 'Create Game Post',
    location: 'subreddit',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
        const { reddit, ui } = context;

        try {
            const subreddit = await reddit.getCurrentSubreddit();

            const post = await reddit.submitPost({
                title: '🎮 Play Now!',
                subredditName: subreddit.name,
                preview: (
                    <vstack height="100%" width="100%" alignment="middle center" gap="medium" backgroundColor={BG_PRIMARY}>
                        <image
                            url="logo.png"
                            imageHeight={100}
                            imageWidth={240}
                            resizeMode="fit"
                        />
                        <spacer />
                        <text size="medium" color="#878a8c">Loading game...</text>
                    </vstack>
                ),
            });

            ui.showToast({
                text: '✅ Game post created!',
                appearance: 'success',
            });

            ui.navigateTo(post);

        } catch {
            ui.showToast({
                text: '❌ Failed to create post',
                appearance: 'neutral',
            });
        }
    },
});

export default Devvit;
