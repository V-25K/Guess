/**
 * Challenge Attempt Types
 * Defines all types related to challenge attempts and completions
 */

export type ChallengeAttempt = {
  id: string;
  user_id: string;
  challenge_id: string;
  attempts_made: number;
  /** @deprecated Use attempts_made instead. Kept for backward compatibility. */
  images_revealed: number;
  is_solved: boolean;
  game_over: boolean;
  points_earned: number;
  experience_earned: number;
  attempted_at: string;
  completed_at: string | null;
};

export type ChallengeAttemptCreate = Omit<ChallengeAttempt, 'id' | 'attempted_at'>;

export type ChallengeAttemptUpdate = Partial<Omit<ChallengeAttempt, 'id' | 'user_id' | 'challenge_id' | 'attempted_at'>>;

export type AttemptGuess = {
  id: string;
  attempt_id: string;
  guess_text: string;
  validation_result: 'CORRECT' | 'CLOSE' | 'INCORRECT';
  ai_explanation: string | null;
  created_at: string;
};

export type AttemptGuessCreate = Omit<AttemptGuess, 'id' | 'created_at'>;

export type AttemptResult = {
  isCorrect: boolean;
  explanation: string;
  attemptsRemaining: number;
  potentialScore: number;
  gameOver: boolean;
  reward?: {
    points: number;
    experience: number;
  };
};
