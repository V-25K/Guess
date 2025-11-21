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
import { calculatePotentialScore } from '../../../shared/utils/reward-calculator.js';

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

  // Trigger state for answer submission (useAsync pattern)
  const [submittedGuess, setSubmittedGuess] = useState<string | null>(null);

  // Polyfill for useRef since it's not available in this version
  const [isProcessingRef] = useState<{ current: boolean }>({ current: false });

  // Check for existing attempt status
  const { data: attemptData, loading: checkingCompletion } = useAsync(async () => {
    if (!currentChallenge || !userId) return null;

    const attemptRepo = new AttemptRepository(context);
    const userRepo = new UserRepository(context);
    const userService = new UserService(context, userRepo);
    const attemptService = new AttemptService(context, attemptRepo, userService);

    // Get attempt regardless of completion status
    return await attemptService.getAttempt(userId, currentChallenge.id);
  }, {
    depends: [currentChallenge?.id || '', userId],
    finally: (data) => {
      // Guard: Don't update state if we are currently processing a guess
      if (isProcessingRef.current) return;

      if (data) {
        // Calculate potential score for NEXT attempt
        const potentialScore = calculatePotentialScore(data.attempts_made);

        setGameState({
          attemptCount: data.attempts_made,
          attemptsRemaining: data.game_over ? 0 : Math.max(0, 10 - data.attempts_made),
          potentialScore: potentialScore,
          message: data.is_solved
            ? `You earned +${data.points_earned} points!`
            : data.game_over
              ? 'You\'ve used all 10 attempts'
              : 'What connects these images?',
          isGameOver: data.game_over || data.is_solved,
          isCorrect: data.is_solved,
        });
      }
    }
  });

  const isCompleted = attemptData?.is_solved || false;
  const isGameOver = attemptData?.game_over || false;
  const completedScore = attemptData?.points_earned || 0;



  // useAsync pattern: Process answer when submittedGuess changes
  const { data: answerResult, loading: isProcessing, error: processingError } = useAsync(
    async () => {
      if (!submittedGuess || !currentChallenge) return null;

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
        submittedGuess
      );

      return result;
    },
    {
      depends: [submittedGuess],
      finally: (result) => {
        if (result) {
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
        }
      }
    }
  );

  // Keep ref in sync with loading state
  isProcessingRef.current = isProcessing;

  // Form for answer submission
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
      description: 'What connects these images?',
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
    },
    async (values) => {
      // Trigger the useAsync by setting submittedGuess
      setSubmittedGuess(values.answer);

      // Update UI immediately to show "Thinking..."
      setGameState(prev => ({
        ...prev,
        message: '🤖 Thinking...',
      }));
    }
  );

  const handleOpenAnswerForm = () => {
    // Check if user is the creator
    if (currentChallenge && userId === currentChallenge.creator_id) {
      context.ui.showToast("❌ You can't answer your own challenge!");
      return;
    }

    // Show the form
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

      isProcessing={isProcessing}
      uniquePlayerCount={currentChallenge.players_played || 0}
      playersCompleted={currentChallenge.players_completed || 0}
    />
  );
};
