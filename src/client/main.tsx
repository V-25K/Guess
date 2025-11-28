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
import { AIValidationService } from '../server/services/ai-validation.service.js';
import { LeaderboardService } from '../server/services/leaderboard.service.js';
import { CommentService } from '../server/services/comment.service.js';

import { UserRepository } from '../server/repositories/user.repository.js';
import { ChallengeRepository } from '../server/repositories/challenge.repository.js';
import { AttemptRepository } from '../server/repositories/attempt.repository.js';
import { CommentRepository } from '../server/repositories/comment.repository.js';

import { useNavigation } from './hooks/useNavigation.js';
import { useRewards } from './hooks/useRewards.js';

import { NavigationBar, ViewContainer } from './components/navigation/index.js';
import { ErrorBoundary, LoadingView, AllCaughtUpView } from './components/shared/index.js';
import { ProfileView } from './components/profile/index.js';
import { LeaderboardView } from './components/leaderboard/index.js';
import { GameplayViewWrapper } from './components/gameplay/index.js';
import { ChallengeCreationView } from './components/creation/index.js';
import { MainMenuView } from './components/menu/index.js';
import type { ChallengeCreationViewProps } from './components/creation/ChallengeCreationView.js';
import type { MainMenuViewProps } from './components/menu/MainMenuView.js';
import { RewardNotification } from './components/shared/RewardNotification.js';
import { AwardsView } from './components/awards/AwardsView.js';

import { convertToGameChallenges } from '../shared/utils/challenge-utils.js';
import { fetchAvatarUrl } from '../server/utils/challenge-utils.js';

import type { GameChallenge } from '../shared/models/challenge.types.js';

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
    const aiValidationService = new AIValidationService(context);
    const leaderboardService = new LeaderboardService(context, userRepo);
    const commentService = new CommentService(context, commentRepo, userService);

    return {
        userService,
        challengeService,
        attemptService,
        aiValidationService,
        leaderboardService,
        commentService,
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
            <vstack alignment="center middle" padding="large" gap="large" width="100%" height="100%" backgroundColor="#F6F7F8">
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

    // Load user profile separately to ensure state updates work
    useAsync(async () => {
        if (!currentUser) return null;

        const profile = await services.userService.getUserProfile(userId, username);
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
            // Check if user has subscribed (tracked in Redis)
            try {
                const subscriptionKey = `subscription:${userId}`;
                const isSubscribed = await context.redis.get(subscriptionKey);
                setIsMember(isSubscribed === 'true');
            } catch (error) {
                setIsMember(false);
            }

            const rateLimitCheck = await services.userService.canCreateChallenge(userId);
            setCanCreateChallenge(rateLimitCheck.canCreate);
            setRateLimitTimeRemaining(rateLimitCheck.timeRemaining);

            const dbChallenges = await services.challengeService.getChallenges();
            const gameChallenges = convertToGameChallenges(dbChallenges);

            // Fetch avatars
            await Promise.all(
                gameChallenges.map(async (challenge) => {
                    try {
                        const avatarUrl = await fetchAvatarUrl(context, challenge.creator_username);
                        if (avatarUrl) {
                            challenge.creator_avatar_url = avatarUrl;
                        }
                    } catch (error) {
                        console.error('[Main] Error fetching avatar:', error);
                    }
                })
            );

            // Filter out completed, game over, or user's own challenges
            // OPTIMIZATION: Fetch all user attempts in one go
            const userAttempts = await services.attemptService.getUserAttempts(userId);
            const attemptMap = new Map(userAttempts.map(a => [a.challenge_id, a]));

            const available: GameChallenge[] = [];
            for (const challenge of gameChallenges) {
                // Skip challenges created by the current user
                if (challenge.creator_id === userId) {
                    continue;
                }

                const attempt = attemptMap.get(challenge.id);

                // Include challenge if not attempted, or if attempted but not completed and not game over
                if (!attempt || (!attempt.is_solved && !attempt.game_over)) {
                    available.push(challenge);
                }
            }

            return { allChallenges: gameChallenges, availableChallenges: available };
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
                setCurrentChallengeIndex(nextIndex);
                setIsLoadingNext(false);
            } else {
                // Refresh available challenges to check if any new ones are available
                // OPTIMIZATION: Fetch all user attempts in one go instead of N+1 requests
                const userAttempts = await services.attemptService.getUserAttempts(userId);
                const attemptMap = new Map(userAttempts.map(a => [a.challenge_id, a]));

                const available: GameChallenge[] = [];
                for (const challenge of challenges) {
                    // Skip challenges created by the current user
                    if (challenge.creator_id === userId) {
                        continue;
                    }

                    const attempt = attemptMap.get(challenge.id);

                    // Include challenge if not attempted, or if attempted but not completed and not game over
                    if (!attempt || (!attempt.is_solved && !attempt.game_over)) {
                        available.push(challenge);
                    }
                }
                setAvailableChallenges(available);
                setCurrentChallengeIndex(0);
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
            // Refresh all challenges from database
            const dbChallenges = await services.challengeService.getChallenges();
            const gameChallenges = convertToGameChallenges(dbChallenges);

            // Fetch avatars for new challenges
            await Promise.all(
                gameChallenges.map(async (challenge) => {
                    try {
                        const avatarUrl = await fetchAvatarUrl(context, challenge.creator_username);
                        if (avatarUrl) {
                            challenge.creator_avatar_url = avatarUrl;
                        }
                    } catch (error) {
                        console.error('[Main] Error fetching avatar:', error);
                    }
                })
            );

            setChallenges(gameChallenges);

            // Refresh available challenges (exclude own challenges)
            // OPTIMIZATION: Fetch all user attempts in one go
            const userAttempts = await services.attemptService.getUserAttempts(userId);
            const attemptMap = new Map(userAttempts.map(a => [a.challenge_id, a]));

            const available: GameChallenge[] = [];
            for (const challenge of gameChallenges) {
                // Skip challenges created by the current user
                if (challenge.creator_id === userId) {
                    continue;
                }

                const attempt = attemptMap.get(challenge.id);

                // Include challenge if not attempted, or if attempted but not completed and not game over
                if (!attempt || (!attempt.is_solved && !attempt.game_over)) {
                    available.push(challenge);
                }
            }
            setAvailableChallenges(available);

            // Update rate limit status
            const newRateLimitCheck = await services.userService.canCreateChallenge(userId);
            setCanCreateChallenge(newRateLimitCheck.canCreate);
            setRateLimitTimeRemaining(newRateLimitCheck.timeRemaining);

        } catch (error) {
            console.error('[Main] Error refreshing data after challenge creation:', error);
        }
    };

    const CreateView = () => {
        const createProps = {
            userId,
            username,
            canCreateChallenge,
            userLevel,
            isModerator,
            challengeService: services.challengeService,
            userService: services.userService,
            onSuccess: handleChallengeCreated,
            onCancel: () => navigateTo('menu'),
            onBackToMenu: () => navigateTo('menu'),
        };
        return <ChallengeCreationView {...createProps as ChallengeCreationViewProps} />;
    };

    if (currentView === 'loading') {
        return <LoadingView />;
    }

    if (currentView === 'menu') {
        const menuProps = {
            canCreateChallenge,
            rateLimitTimeRemaining,
            challengesCount: challenges.length,
            isMember,
            userLevel,
            isModerator,
            onNavigate: navigateTo,
            onSubscribe: handleSubscribe,
        };
        return <MainMenuView {...menuProps as MainMenuViewProps} />;
    }

    if (currentView === 'gameplay') {

        // If viewing a specific challenge, always show it (even if completed)
        if (isViewingSpecificChallenge) {
            // Safety check: ensure challenge exists
            if (!currentChallenge) {
                console.warn('[Main] No current challenge found in gameplay view');
                return (
                    <AllCaughtUpView
                        onBackToMenu={() => {
                            setIsViewingSpecificChallenge(false);
                            navigateTo('menu');
                        }}
                        message="Challenge not found"
                    />
                );
            }

            return (
                <ErrorBoundary
                    onError={() => {/* Error logged by ErrorBoundary component */ }}
                    onReset={() => navigateTo('menu')}
                >
                    <GameplayViewWrapper
                        userId={userId}
                        currentChallenge={currentChallenge}
                        challenges={challenges}
                        currentChallengeIndex={currentChallengeIndex}
                        onNextChallenge={handleNextChallenge}
                        onBackToMenu={() => {
                            setIsViewingSpecificChallenge(false);
                            navigateTo('menu');
                        }}
                        isLoadingNext={isLoadingNext}
                        onReward={showReward}
                    />
                </ErrorBoundary>
            );
        }

        // Show loading while challenges are being fetched
        if (!challengesLoaded) {
            return <LoadingView />;
        }

        // Check if we have available challenges to show
        if (availableChallenges.length === 0 || !currentChallenge) {
            return (
                <AllCaughtUpView
                    onBackToMenu={() => navigateTo('menu')}
                    message={challenges.length === 0
                        ? "No challenges available yet. Create one to get started!"
                        : "You've completed all available challenges!"}
                />
            );
        }

        return (
            <ErrorBoundary
                onError={() => {/* Error logged by ErrorBoundary component */ }}
                onReset={() => navigateTo('menu')}
            >
                <GameplayViewWrapper
                    userId={userId}
                    currentChallenge={currentChallenge}
                    challenges={availableChallenges}
                    currentChallengeIndex={currentChallengeIndex}
                    onNextChallenge={handleNextChallenge}
                    onBackToMenu={() => navigateTo('menu')}
                    isLoadingNext={isLoadingNext}
                    onReward={showReward}
                />
            </ErrorBoundary>
        );
    }

    return (
        <zstack width="100%" height="100%" alignment="center middle">
            <vstack width="100%" height="100%" gap="none">
                <NavigationBar
                    currentView={currentView}
                    onNavigate={navigateTo}
                />

                <ViewContainer currentView={currentView}>
                    {currentView === 'profile' && (
                        <ErrorBoundary
                            onError={() => {/* Error logged by ErrorBoundary component */ }}
                            onReset={() => navigateTo('menu')}
                        >
                            <ProfileView
                                userId={userId}
                                username={username}
                                userService={services.userService}
                            />
                        </ErrorBoundary>
                    )}
                    {currentView === 'leaderboard' && (
                        <ErrorBoundary
                            onError={() => {/* Error logged by ErrorBoundary component */ }}
                            onReset={() => navigateTo('menu')}
                        >
                            <LeaderboardView
                                userId={userId}
                                leaderboardService={services.leaderboardService}
                            />
                        </ErrorBoundary>
                    )}
                    {currentView === 'create' && (
                        <ErrorBoundary
                            onError={() => {/* Error logged by ErrorBoundary component */ }}
                            onReset={() => navigateTo('menu')}
                        >
                            <CreateView />
                        </ErrorBoundary>
                    )}
                    {currentView === 'awards' && (
                        <ErrorBoundary
                            onError={() => {/* Error logged by ErrorBoundary component */ }}
                            onReset={() => navigateTo('menu')}
                        >
                            <AwardsView
                                userId={userId}
                                username={username}
                                userService={services.userService}
                                onBack={() => navigateTo('menu')}
                            />
                        </ErrorBoundary>
                    )}
                </ViewContainer>
            </vstack>

            {/* Reward Notification Overlay */}
            {currentReward && (
                <RewardNotification
                    type={currentReward.type}
                    points={currentReward.points}
                    experience={currentReward.experience}
                    level={currentReward.level}
                    message={currentReward.message}
                    onDismiss={dismissReward}
                />
            )}
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
                    <vstack height="100%" width="100%" alignment="middle center" gap="medium" backgroundColor="#F6F7F8">
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
