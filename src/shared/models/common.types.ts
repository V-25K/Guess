/**
 * Common Types
 * Shared types used across the application
 */

export type ViewType = 'menu' | 'gameplay' | 'profile' | 'leaderboard' | 'create';

export type NavigationState = {
  currentView: ViewType;
  previousView: ViewType | null;
  userId: string;
};

export type ErrorState = {
  type: 'info' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
};

export type LoadingState = {
  isLoading: boolean;
  message?: string;
};

export type GameState = {
  revealedCount: number;
  score: number;
  message: string;
  isGameOver: boolean;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  level: number;
  challengesSolved: number;
  isCurrentUser: boolean;
};

export type Reward = {
  points: number;
  exp: number;
};

export type RateLimitCheck = {
  canCreate: boolean;
  timeRemaining: number;
};
