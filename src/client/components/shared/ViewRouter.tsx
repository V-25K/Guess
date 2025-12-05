import { Devvit } from '@devvit/public-api';
import { LoadingView, AllCaughtUpView, ErrorBoundary } from './index.js';
import { MainMenuView, MainMenuViewProps } from '../menu/index.js';
import { GameplayViewWrapper } from '../gameplay/index.js';
import { ProfileView } from '../profile/index.js';
import { LeaderboardView } from '../leaderboard/index.js';
import { ChallengeCreationView, ChallengeCreationViewProps } from '../creation/index.js';
import { AwardsView } from '../awards/AwardsView.js';
import { NavigationBar, ViewContainer } from '../navigation/index.js';
import type { GameChallenge } from '../../../shared/models/challenge.types.js';
import type { UserProfile } from '../../../shared/models/user.types.js';
import type { PaginatedLeaderboardResult } from '../../../server/services/leaderboard.service.js';
import type { UserService } from '../../../server/services/user.service.js';
import type { ChallengeService } from '../../../server/services/challenge.service.js';
import type { LeaderboardService } from '../../../server/services/leaderboard.service.js';
import type { ViewType } from '../../hooks/useNavigation.js';
import type { Reward } from '../../hooks/useRewards.js';

export interface ViewRouterProps {
    currentView: ViewType;
    navigateTo: (view: ViewType) => void;

    // User Data
    userId: string;
    username: string;
    userLevel: number;
    isModerator: boolean;
    isMember: boolean;

    // Game State
    challenges: GameChallenge[];
    availableChallenges: GameChallenge[];
    currentChallenge: GameChallenge | null;
    currentChallengeIndex: number;
    isViewingSpecificChallenge: boolean;
    challengesLoaded: boolean;
    isLoadingNext: boolean;
    canCreateChallenge: boolean;
    rateLimitTimeRemaining: number;

    // Services
    userService: UserService;
    challengeService: ChallengeService;
    leaderboardService: LeaderboardService;

    // Cache
    cachedProfile: UserProfile | null;
    setCachedProfile: (profile: UserProfile | null) => void;
    cachedLeaderboard: PaginatedLeaderboardResult | null;
    setCachedLeaderboard: (result: PaginatedLeaderboardResult | null) => void;
    cachedAvatarUrl: string | null;

    // Actions
    handleNextChallenge: (index: number) => void;
    handleSubscribe: () => void;
    handleChallengeCreated: (challenge: any) => void;
    showReward: (reward: Omit<Reward, 'id' | 'timestamp'>) => void;
    setIsViewingSpecificChallenge: (viewing: boolean) => void;
}

export const ViewRouter = (props: ViewRouterProps) => {
    const {
        currentView,
        navigateTo,
        userId,
        username,
        userLevel,
        isModerator,
        isMember,
        challenges,
        availableChallenges,
        currentChallenge,
        currentChallengeIndex,
        isViewingSpecificChallenge,
        challengesLoaded,
        isLoadingNext,
        canCreateChallenge,
        rateLimitTimeRemaining,
        userService,
        challengeService,
        leaderboardService,
        cachedProfile,
        setCachedProfile,
        cachedLeaderboard,
        setCachedLeaderboard,
        cachedAvatarUrl,
        handleNextChallenge,
        handleSubscribe,
        handleChallengeCreated,
        showReward,
        setIsViewingSpecificChallenge,
    } = props;

    // Loading State
    if (currentView === 'loading') {
        return <LoadingView />;
    }

    // Menu View
    if (currentView === 'menu') {
        const menuProps: MainMenuViewProps = {
            canCreateChallenge,
            rateLimitTimeRemaining,
            challengesCount: challenges.length,
            isMember,
            userLevel,
            isModerator,
            onNavigate: navigateTo,
            onSubscribe: handleSubscribe,
        };
        return <MainMenuView {...menuProps} />;
    }

    // Gameplay View
    if (currentView === 'gameplay') {
        if (isViewingSpecificChallenge) {
            if (!currentChallenge) {
                console.warn('[ViewRouter] No current challenge found in gameplay view');
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
                    onError={(error) => console.error('[ErrorBoundary] Render error:', error)}
                    onReset={() => navigateTo('menu')}
                >
                    <GameplayViewWrapper
                        userId={userId}
                        currentChallenge={currentChallenge}
                        challenges={challenges}
                        currentChallengeIndex={currentChallengeIndex}
                        onNextChallenge={() => handleNextChallenge(currentChallengeIndex + 1)}
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

        if (!challengesLoaded) {
            return <LoadingView />;
        }

        if (isLoadingNext) {
            return (
                <vstack
                    alignment="center middle"
                    padding="medium"
                    gap="medium"
                    width="100%"
                    height="100%"
                    backgroundColor="#F2F4F5" // BG_PRIMARY
                >
                    <image
                        url="logo.png"
                        imageHeight={100}
                        imageWidth={240}
                        resizeMode="fit"
                    />
                    <vstack gap="small" alignment="center middle">
                        <text size="large" weight="bold" color="#1c1c1c">
                            Loading Next Challenge...
                        </text>
                        <text size="medium" color="#878a8c">
                            Finding a new puzzle for you
                        </text>
                    </vstack>
                </vstack>
            );
        }

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
                onError={(error) => console.error('[ErrorBoundary] Render error:', error)}
                onReset={() => navigateTo('menu')}
            >
                <GameplayViewWrapper
                    userId={userId}
                    currentChallenge={currentChallenge}
                    challenges={availableChallenges}
                    currentChallengeIndex={currentChallengeIndex}
                    onNextChallenge={() => handleNextChallenge(currentChallengeIndex + 1)}
                    onBackToMenu={() => navigateTo('menu')}
                    isLoadingNext={isLoadingNext}
                    onReward={showReward}
                />
            </ErrorBoundary>
        );
    }

    // Create View
    if (currentView === 'create') {
        const createProps: ChallengeCreationViewProps = {
            userId,
            username,
            canCreateChallenge,
            userLevel,
            isModerator,
            challengeService,
            userService,
            onSuccess: handleChallengeCreated,
            onCancel: () => navigateTo('menu'),
            onBackToMenu: () => navigateTo('menu'),
        };
        return <ChallengeCreationView {...createProps} />;
    }

    // Navigation Views (Profile, Leaderboard, Awards)
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
                            onError={(error) => console.error('[ErrorBoundary] Render error:', error)}
                            onReset={() => navigateTo('menu')}
                        >
                            <ProfileView
                                userId={userId}
                                username={username}
                                userService={userService}
                                cachedProfile={cachedProfile}
                                onProfileLoaded={setCachedProfile}
                                cachedAvatarUrl={cachedAvatarUrl}
                            />
                        </ErrorBoundary>
                    )}

                    {currentView === 'leaderboard' && (
                        <ErrorBoundary
                            onError={(error) => console.error('[ErrorBoundary] Render error:', error)}
                            onReset={() => navigateTo('menu')}
                        >
                            <LeaderboardView
                                leaderboardService={leaderboardService}
                                userId={userId}
                                cachedData={cachedLeaderboard}
                                onDataLoaded={setCachedLeaderboard}
                            />
                        </ErrorBoundary>
                    )}

                    {currentView === 'awards' && (
                        <ErrorBoundary
                            onError={(error) => console.error('[ErrorBoundary] Render error:', error)}
                            onReset={() => navigateTo('menu')}
                        >
                            <AwardsView
                                userId={userId}
                                username={username}
                                userService={userService}
                                cachedProfile={cachedProfile}
                                onProfileLoaded={setCachedProfile}
                                onBack={() => navigateTo('menu')}
                            />
                        </ErrorBoundary>
                    )}
                </ViewContainer>
            </vstack>
        </zstack>
    );
};
