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

import { NavigationBar, ViewContainer } from './components/navigation/index.js';
import { ErrorBoundary, LoadingView, AllCaughtUpView } from './components/shared/index.js';
import { ProfileView } from './components/profile/index.js';
import { LeaderboardView } from './components/leaderboard/index.js';
import { GameplayViewWrapper } from './components/gameplay/index.js';
import { ChallengeCreationView } from './components/creation/index.js';
import { MainMenuView } from './components/menu/index.js';

import { convertToGameChallenges } from '../shared/utils/challenge-utils.js';
import { fetchAvatarUrl } from '../server/utils/challenge-utils.js';

import type { GameChallenge } from '../shared/models/challenge.types.js';

/**
 * Initialize all services with dependency injection
 * This creates the service layer that handles all business logic
 * Accepts both Context and TriggerContext types
 */
function initializeServices(context: Context | any) {
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
    
    const { data: currentUser, error: userError } = useAsync<{ id: string; username: string } | null>(async () => {
        try {
            const user = await context.reddit.getCurrentUser();
            if (!user) return null;
            return {
                id: user.id || 'anonymous',
                username: user.username || 'anonymous'
            };
        } catch (error) {
            return null;
        }
    });
    
    // Handle user authentication errors
    if (userError) {
        return (
            <vstack alignment="center middle" padding="large" gap="medium" width="100%" height="100%" backgroundColor="#F6F7F8">
                <text size="xlarge">⚠️</text>
                <text size="large" weight="bold" color="#1c1c1c">Authentication Error</text>
                <text size="medium" color="#878a8c" alignment="center">
                    Unable to authenticate. Please try refreshing the page.
                </text>
            </vstack>
        );
    }
    
    const userId = currentUser?.id || 'anonymous';
    const username = currentUser?.username || 'anonymous';
    
    // Check if this post has a specific challenge to open
    const postData = context.postData as { challengeId?: string; openDirectly?: boolean } | undefined;
    const shouldOpenChallenge = postData?.openDirectly && postData?.challengeId;
    
    const { currentView, navigateTo } = useNavigation('loading');
    
    const [challenges, setChallenges] = useState<GameChallenge[]>([]);
    const [availableChallenges, setAvailableChallenges] = useState<GameChallenge[]>([]);
    const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
    const [isViewingSpecificChallenge, setIsViewingSpecificChallenge] = useState(false);
    
    const [canCreateChallenge, setCanCreateChallenge] = useState(true);
    const [isMember, setIsMember] = useState(false);
    const [subredditName] = useState<string>('guess_the_1ink_dev'); // Hardcoded subreddit name
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
    
    useAsync<GameChallenge[]>(async () => {
        if (!currentUser) return [];
        
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
                    }
                })
            );
            
            // Filter out completed or game over challenges
            const available: GameChallenge[] = [];
            for (const challenge of gameChallenges) {
                try {
                    const attemptStatus = await services.attemptService.getAttemptStatus(userId, challenge.id);
                    // Include challenge if not attempted, or if attempted but not completed and not game over
                    if (!attemptStatus || (!attemptStatus.is_solved && !attemptStatus.game_over)) {
                        available.push(challenge);
                    }
                } catch (error) {
                    available.push(challenge);
                }
            }
            
            setAvailableChallenges(available);
            
            return gameChallenges;
        } catch (error) {
            return [];
        }
    }, {
        depends: [currentUser?.id || 'anonymous'],
        finally: (data) => {
            if (data && data.length > 0) {
                setChallenges(data);
                
                // If this post should open a specific challenge, find and set it
                if (shouldOpenChallenge && postData?.challengeId) {
                    const challengeIndex = data.findIndex(c => c.id === postData.challengeId);
                    if (challengeIndex !== -1) {
                        setCurrentChallengeIndex(challengeIndex);
                        setIsViewingSpecificChallenge(true);
                        navigateTo('gameplay');
                        return;
                    }
                }
            }
            
            if (currentView === 'loading') {
                navigateTo('menu');
            }
        }
    });
    
    // Use full challenges list if viewing specific challenge, otherwise use available challenges
    const activeChallenges = isViewingSpecificChallenge ? challenges : availableChallenges;
    const currentChallenge = activeChallenges[currentChallengeIndex] || null;
    
    const handleNextChallenge = async () => {
        try {
            if (isViewingSpecificChallenge) {
                // When viewing a specific challenge, switch to browsing mode
                setIsViewingSpecificChallenge(false);
                setCurrentChallengeIndex(0);
                return;
            }
            
            // Validate current index
            const nextIndex = currentChallengeIndex + 1;
            
            // Move to next available challenge
            if (nextIndex < availableChallenges.length && availableChallenges[nextIndex]) {
                setCurrentChallengeIndex(nextIndex);
            } else {
                // Refresh available challenges to check if any new ones are available
                const available: GameChallenge[] = [];
                for (const challenge of challenges) {
                    try {
                        const attemptStatus = await services.attemptService.getAttemptStatus(userId, challenge.id);
                        if (!attemptStatus || (!attemptStatus.is_solved && !attemptStatus.game_over)) {
                            available.push(challenge);
                        }
                    } catch (error) {
                        available.push(challenge);
                    }
                }
                setAvailableChallenges(available);
                setCurrentChallengeIndex(0);
            }
        } catch (error) {
            context.ui.showToast('⚠️ Error loading next challenge');
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
                    context.ui.navigateTo(`https://www.reddit.com/r/${subredditName}`);
                    
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
    
    const handleChallengeCreated = async () => {
        try {
            const dbChallenges = await services.challengeService.getChallenges();
            const gameChallenges = convertToGameChallenges(dbChallenges);
            setChallenges(gameChallenges);
            
            // Refresh available challenges
            const available: GameChallenge[] = [];
            for (const challenge of gameChallenges) {
                try {
                    const attemptStatus = await services.attemptService.getAttemptStatus(userId, challenge.id);
                    if (!attemptStatus || (!attemptStatus.is_solved && !attemptStatus.game_over)) {
                        available.push(challenge);
                    }
                } catch (error) {
                    console.error(`[Main] Error checking attempt status:`, error);
                    available.push(challenge);
                }
            }
            setAvailableChallenges(available);
            
            const newRateLimitCheck = await services.userService.canCreateChallenge(userId);
            setCanCreateChallenge(newRateLimitCheck.canCreate);
            
            navigateTo('menu');
        } catch (error) {
            console.error('[Main] Error in handleChallengeCreated:', error);
            context.ui.showToast('⚠️ Error refreshing challenges');
            navigateTo('menu');
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
        };
        return <ChallengeCreationView {...createProps as any} />;
    };
    
    if (currentView === 'loading') {
        return <LoadingView />;
    }
    
    if (currentView === 'menu') {
        console.log(`[Main] Rendering menu - isModerator: ${isModerator}, userLevel: ${userLevel}`);
        const menuProps = {
            canCreateChallenge,
            challengesCount: challenges.length,
            isMember,
            userLevel,
            isModerator,
            onNavigate: navigateTo,
            onSubscribe: handleSubscribe,
        };
        return <MainMenuView {...menuProps as any} />;
    }
    
    if (currentView === 'gameplay') {
        // If viewing a specific challenge, always show it (even if completed)
        if (isViewingSpecificChallenge) {
            // Safety check: ensure challenge exists
            if (!currentChallenge) {
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
                    onError={() => {/* Error logged by ErrorBoundary component */}}
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
                    />
                </ErrorBoundary>
            );
        }
        
        // Check if we have available challenges to show
        if (availableChallenges.length === 0 || !currentChallenge) {
            return (
                <AllCaughtUpView
                    onBackToMenu={() => navigateTo('menu')}
                    message="You've completed all available challenges!"
                />
            );
        }
        
        return (
            <ErrorBoundary
                onError={() => {/* Error logged by ErrorBoundary component */}}
                onReset={() => navigateTo('menu')}
            >
                <GameplayViewWrapper
                    userId={userId}
                    currentChallenge={currentChallenge}
                    challenges={availableChallenges}
                    currentChallengeIndex={currentChallengeIndex}
                    onNextChallenge={handleNextChallenge}
                    onBackToMenu={() => navigateTo('menu')}
                />
            </ErrorBoundary>
        );
    }
    
    return (
        <vstack width="100%" height="100%" gap="none">
            <NavigationBar 
                currentView={currentView} 
                onNavigate={navigateTo}
            />
            
            <ViewContainer currentView={currentView}>
                {currentView === 'profile' && (
                    <ErrorBoundary
                        onError={() => {/* Error logged by ErrorBoundary component */}}
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
                        onError={() => {/* Error logged by ErrorBoundary component */}}
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
                        onError={() => {/* Error logged by ErrorBoundary component */}}
                        onReset={() => navigateTo('menu')}
                    >
                        <CreateView />
                    </ErrorBoundary>
                )}
            </ViewContainer>
        </vstack>
    );
};

Devvit.configure({
    redditAPI: true,
    redis: true,
    http: {
        domains: [
            'generativelanguage.googleapis.com',
            'jqgithkiinvgcpskwado.supabase.co',
        ],
    },
});

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
    name: 'Guess The Link',
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
            
            const services = initializeServices(context);
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
            
        } catch {
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
                title: '🎮 Guess The Link - Play Now!',
                subredditName: subreddit.name,
                preview: (
                    <vstack height="100%" width="100%" alignment="middle center">
                        <text size="xlarge" weight="bold">🎮 Guess The Link</text>
                        <spacer />
                        <text size="medium">Loading game...</text>
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
