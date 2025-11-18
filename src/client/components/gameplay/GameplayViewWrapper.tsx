/**
 * Gameplay View Wrapper Component
 * Wraps PlayGameView with form logic and state management
 * 
 * Updated for attempt-based scoring system:
 * - All images revealed immediately
 * - Tracks attempt count instead of revealed images
 * - Uses new submitGuess signature with guess text
 */

import { Devvit, useForm, useAsync, useState } from '@devvit/public-api';
import { PlayGameView } from './PlayGameView.js';
import type { GameChallenge } from '../../../shared/models/challenge.types.js';
import { AttemptService } from '../../../server/services/attempt.service.js';
import { UserService } from '../../../server/services/user.service.js';
import { AttemptRepository } from '../../../server/repositories/attempt.repository.js';
import { ChallengeRepository } from '../../../server/repositories/challenge.repository.js';
import { UserRepository } from '../../../server/repositories/user.repository.js';

export interface GameplayViewWrapperProps {
  userId: string;
  currentChallenge: GameChallenge | null;
  challenges: GameChallenge[];
  currentChallengeIndex: number;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
}

/**
 * Gameplay View Wrapper
 * Handles answer form submission and game logic with attempt-based scoring
 */
export const GameplayViewWrapper: Devvit.BlockComponent<GameplayViewWrapperProps> = (
  {
    userId,
    currentChallenge,
    challenges,
    currentChallengeIndex,
    onNextChallenge,
    onBackToMenu,
  },
  context
) => {
  // Game state with attempt tracking (replaces revealedCount/score)
  const [gameState, setGameState] = useState<{
    attemptCount: number;
    attemptsRemaining: number;
    potentialScore: number;
    message: string;
    isGameOver: boolean;
    isCorrect: boolean;
  }>({
    attemptCount: 0,
    attemptsRemaining: 10,
    potentialScore: 30,
    message: 'What connects these images?',
    isGameOver: false,
    isCorrect: false,
  });

  // Check if challenge is already completed or game over
  const { data: attemptData, loading: checkingCompletion } = useAsync(async () => {
    if (!currentChallenge) return null;
    
    const attemptRepo = new AttemptRepository(context);
    const userRepo = new UserRepository(context);
    const userService = new UserService(context, userRepo);
    const attemptService = new AttemptService(context, attemptRepo, userService);
    
    // Use getAttemptStatus instead of getCompletionStatus to check for both completed and game over
    return await attemptService.getAttemptStatus(userId, currentChallenge.id);
  }, { 
    depends: [currentChallenge?.id || '', userId],
    finally: (data) => {
      // If game is over (either completed or failed), update game state
      if (data && (data.is_solved || data.game_over)) {
        setGameState({
          attemptCount: data.attempts_made,
          attemptsRemaining: data.game_over && !data.is_solved ? 0 : 10 - data.attempts_made,
          potentialScore: 0,
          message: data.is_solved 
            ? `You earned +${data.points_earned} points!`
            : 'You\'ve used all 10 attempts',
          isGameOver: true,
          isCorrect: data.is_solved,
        });
      }
    }
  });
  
  const isCompleted = attemptData?.is_solved || false;
  const isGameOver = attemptData?.game_over || false;
  const completedScore = attemptData?.points_earned || 0;
  const answerForm = useForm(
    {
      fields: [
        {
          name: 'answer',
          label: 'What connects these images?',
          type: 'string',
          required: true,
        },
      ],
      title: 'Your Answer',
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
    },
    async (values) => {
      if (!currentChallenge) return;

      const guess = values.answer;

      try {
        // Create services for this async context
        const attemptRepo = new AttemptRepository(context);
        const challengeRepo = new ChallengeRepository(context);
        const userRepo = new UserRepository(context);
        const userService = new UserService(context, userRepo);
        const attemptService = new AttemptService(context, attemptRepo, userService, challengeRepo);

        // Submit guess using new signature (passes guess text, AI validation happens in service)
        const result = await attemptService.submitGuess(
          userId,
          currentChallenge.id,
          guess
        );

        // Update game state with attempt tracking data
        setGameState({
          attemptCount: 10 - result.attemptsRemaining,
          attemptsRemaining: result.attemptsRemaining,
          potentialScore: result.potentialScore,
          message: result.isCorrect 
            ? `You earned +${result.reward?.points || 0} points!`
            : result.explanation,
          isGameOver: result.gameOver,
          isCorrect: result.isCorrect,
        });

        if (result.isCorrect) {
          context.ui.showToast('🎉 Correct answer!');
        } else if (result.gameOver) {
          context.ui.showToast('❌ Game over - no attempts remaining');
        }
      } catch (error) {
        console.error('Error during answer submission:', error);
        context.ui.showToast('⚠️ Error checking answer. Please try again.');
        setGameState((prev) => ({
          ...prev,
          message: '⚠️ Error checking answer. Please try again.',
        }));
      }
    }
  );

  const handleOpenAnswerForm = () => {
    // Check if user is the creator
    if (currentChallenge && userId === currentChallenge.creator_id) {
      context.ui.showToast("❌ You can't answer your own challenge!");
      return;
    }
    context.ui.showForm(answerForm);
  };
  
  // Check if current user is the creator
  const isCreator = currentChallenge ? userId === currentChallenge.creator_id : false;

  if (!currentChallenge) {
    return (
      <vstack
        alignment="center middle"
        padding="medium"
        gap="medium"
        width="100%"
        height="100%"
        backgroundColor="#F6F7F8"
      >
        <text size="large" color="#FF4500">
          📭 No Challenges Available
        </text>
        <text size="small" color="#878a8c" alignment="center">
          {challenges?.length === 0 
            ? 'No challenges have been created yet. Be the first to create one!' 
            : 'Unable to load challenge. Please try again.'}
        </text>
        <button onPress={onBackToMenu} appearance="primary">
          Back to Menu
        </button>
      </vstack>
    );
  }

  return (
    <PlayGameView
      challenge={currentChallenge}
      gameState={gameState}
      attemptCount={gameState.attemptCount}
      attemptsRemaining={gameState.attemptsRemaining}
      potentialScore={gameState.potentialScore}
      onSubmitAnswer={handleOpenAnswerForm}
      onNextChallenge={onNextChallenge}
      onBackToMenu={onBackToMenu}
      isCreator={isCreator}
      isCompleted={isCompleted}
      isGameOver={isGameOver}
      completedScore={completedScore}
      checkingCompletion={checkingCompletion}
    />
  );
};
