/**
 * Challenge Attempt Types
 * Defines all types related to challenge attempts and completions
 */

export type ChallengeAttempt = {
  id: string;
  user_id: string;
  challenge_id: string;
  images_revealed: number;
  is_solved: boolean;
  points_earned: number;
  experience_earned: number;
  attempted_at: string;
  completed_at: string | null;
};

export type ChallengeAttemptCreate = Omit<ChallengeAttempt, 'id' | 'attempted_at'>;

export type ChallengeAttemptUpdate = Partial<Omit<ChallengeAttempt, 'id' | 'user_id' | 'challenge_id' | 'attempted_at'>>;

export type AttemptResult = {
  isCorrect: boolean;
  explanation: string;
  reward?: {
    points: number;
    experience: number;
  };
};
