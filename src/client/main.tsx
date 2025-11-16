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
import { ErrorBoundary, LoadingView } from './components/shared/index.js';
import { ProfileView } from './components/profile/index.js';
import { LeaderboardView } from './components/leaderboard/index.js';
import { GameplayViewWrapper } from './components/gameplay/index.js';
import { ChallengeCreationView } from './components/creation/index.js';
import { MainMenuView } from './components/menu/index.js';

import { convertToGameChallenges } from '../shared/utils/challenge-utils.js';
import { fetchAvatarUrl } from '../server/utils/challenge-utils.js';

import type { Challenge, GameChallenge } from '../shared/models/challenge.types.js';

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
    
    const { data: currentUser } = useAsync<{ id: string; username: string } | null>(async () => {
        const user = await context.reddit.getCurrentUser();
        if (!user) return null;
        return {
            id: user.id || 'anonymous',
            username: user.username || 'anonymous'
        };
    });
    
    const userId = currentUser?.id || 'anonymous';
    const username = currentUser?.username || 'anonymous';
    
    // Check if this post has a specific challenge to open
    const postData = context.postData as { challengeId?: string; openDirectly?: boolean } | undefined;
    const shouldOpenChallenge = postData?.openDirectly && postData?.challengeId;
    
    const { currentView, navigateTo } = useNavigation('loading');
    
    const [challenges, setChallenges] = useState<GameChallenge[]>([]);
    const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
    
    const [gameState, setGameState] = useState<{
        revealedCount: number;
        score: number;
        message: string;
        isGameOver: boolean;
    }>({
        revealedCount: 1,
        score: 25,
        message: '...',
        isGameOver: false,
    });
    
    const [canCreateChallenge, setCanCreateChallenge] = useState(true);
    
    useAsync<GameChallenge[]>(async () => {
        if (!currentUser) return [];
        
        try {
            await services.userService.getUserProfile(userId, username);
            
            const rateLimitCheck = await services.userService.canCreateChallenge(userId);
            setCanCreateChallenge(rateLimitCheck.canCreate);
            
            const dbChallenges = await services.challengeService.getChallenges();
            const gameChallenges = convertToGameChallenges(dbChallenges);
            console.log(`[Main] Converted to ${gameChallenges.length} game challenges`);
            
            await Promise.all(
                gameChallenges.map(async (challenge) => {
                    try {
                        const avatarUrl = await fetchAvatarUrl(context, challenge.creator_username);
                        if (avatarUrl) {
                            challenge.creator_avatar_url = avatarUrl;
                        }
                    } catch (error) {
                        console.error('Failed to fetch avatar:', error);
                    }
                })
            );
            
            return gameChallenges;
        } catch (error) {
            console.error('[Main] Failed to load initial data:', error);
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
                        resetGame(data[challengeIndex]);
                        navigateTo('gameplay');
                        console.log(`[Main] Opening challenge directly: ${postData.challengeId}`);
                        return;
                    }
                }
            }
            
            if (currentView === 'loading') {
                navigateTo('menu');
            }
        }
    });
    
    const currentChallenge = challenges[currentChallengeIndex];
    
    const resetGame = (challenge: GameChallenge) => {
        setGameState({
            revealedCount: 1,
            score: challenge.max_score,
            message: '...',
            isGameOver: false,
        });
        
        setChallenges(prev => prev.map((c, idx) => {
            if (idx === currentChallengeIndex) {
                return {
                    ...c,
                    images: c.images.map((img, i) => ({
                        ...img,
                        isRevealed: i === 0,
                    })),
                };
            }
            return c;
        }));
    };
    
    const handleRevealImage = (index: number) => {
        if (gameState.isGameOver || currentChallenge.images[index].isRevealed) return;
        
        const newScore = Math.max(0, gameState.score - currentChallenge.score_deduction_per_hint);
        const newRevealedCount = gameState.revealedCount + 1;
        
        setChallenges(prev => prev.map((c, idx) => {
            if (idx === currentChallengeIndex) {
                return {
                    ...c,
                    images: c.images.map((img, i) =>
                        i === index ? { ...img, isRevealed: true } : img
                    ),
                };
            }
            return c;
        }));
        
        setGameState(prev => ({
            ...prev,
            revealedCount: newRevealedCount,
            score: newScore,
            message: `Hint revealed! Score deducted by ${currentChallenge.score_deduction_per_hint} points.`,
        }));
        
        services.attemptService.updateImagesRevealed(
            userId,
            currentChallenge.id,
            newRevealedCount
        ).catch(error => {
            console.error('Failed to update images revealed:', error);
        });
    };
    
    const handleNextChallenge = () => {
        const nextIndex = (currentChallengeIndex + 1) % challenges.length;
        setCurrentChallengeIndex(nextIndex);
        resetGame(challenges[nextIndex]);
    };
    
    const handleChallengeCreated = async () => {
        const dbChallenges = await services.challengeService.getChallenges();
        const gameChallenges = convertToGameChallenges(dbChallenges);
        setChallenges(gameChallenges);
        
        const newRateLimitCheck = await services.userService.canCreateChallenge(userId);
        setCanCreateChallenge(newRateLimitCheck.canCreate);
        
        navigateTo('menu');
    };
    
    const CreateView = () => {
        return (
            <ChallengeCreationView
                userId={userId}
                username={username}
                canCreateChallenge={canCreateChallenge}
                challengeService={services.challengeService}
                userService={services.userService}
                onSuccess={handleChallengeCreated}
                onCancel={() => navigateTo('menu')}
            />
        );
    };
    
    if (currentView === 'loading') {
        return <LoadingView />;
    }
    
    if (currentView === 'menu') {
        return (
            <MainMenuView
                canCreateChallenge={canCreateChallenge}
                challengesCount={challenges.length}
                onNavigate={navigateTo}
            />
        );
    }
    
    if (currentView === 'gameplay') {
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
                    gameState={gameState}
                    onRevealImage={handleRevealImage}
                    onNextChallenge={handleNextChallenge}
                    onBackToMenu={() => navigateTo('menu')}
                    setGameState={setGameState}
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
