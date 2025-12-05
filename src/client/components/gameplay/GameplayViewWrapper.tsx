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
import type { Reward } from '../../hooks/useRewards.js';
import { AttemptService } from '../../../server/services/attempt.service.js';
import { UserService } from '../../../server/services/user.service.js';
import { AttemptRepository } from '../../../server/repositories/attempt.repository.js';
import { ChallengeRepository } from '../../../server/repositories/challenge.repository.js';
import { UserRepository } from '../../../server/repositories/user.repository.js';
import { calculatePotentialScore } from '../../../shared/utils/reward-calculator.js';
import { BG_PRIMARY } from '../../constants/colors.js';

export interface GameplayViewWrapperProps {
  userId: string;
  currentChallenge: GameChallenge | null;
  challenges: GameChallenge[];
  currentChallengeIndex: number;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  onReward?: (reward: Omit<Reward, 'id' | 'timestamp'>) => void;
  isLoadingNext?: boolean;
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
    onNextChallenge,
    onBackToMenu,
    onReward,
    isLoadingNext = false,
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
    playersCompleted: number;
    uniquePlayerCount: number;
    bonuses: Array<{ type: string; points: number; exp: number; label: string }>;
  }>({
    attemptCount: 0,
    attemptsRemaining: 10,
    potentialScore: 28,
    message: 'What connects these images?',
    isGameOver: false,
    isCorrect: false,
    playersCompleted: currentChallenge?.players_completed || 0,
    uniquePlayerCount: currentChallenge?.players_played || 0,
    bonuses: [],
  });

  // Trigger state for answer submission (useAsync pattern)
  const [submittedGuess, setSubmittedGuess] = useState<string | null>(null);

  // Polyfill for useRef since it's not available in this version
  const [isProcessingRef] = useState<{ current: boolean }>({ current: false });

  // Check for existing attempt status and fresh challenge data
  const { data: loadData, loading: checkingCompletion } = useAsync(async () => {
    if (!currentChallenge || !userId) return null;

    const attemptRepo = new AttemptRepository(context);
    const userRepo = new UserRepository(context);
    const challengeRepo = new ChallengeRepository(context);
    const userService = new UserService(context, userRepo);
    const attemptService = new AttemptService(context, attemptRepo, userService);

    // Fetch attempt and fresh challenge data in parallel
    const [attempt, challenge] = await Promise.all([
      attemptService.getAttempt(userId, currentChallenge.id),
      challengeRepo.findById(currentChallenge.id)
    ]);

    return { attempt, challenge };
  }, {
    depends: [currentChallenge?.id || '', userId],
    finally: (data) => {
      // Guard: Don't update state if we are currently processing a guess
      if (isProcessingRef.current) return;

      if (data && data.attempt) {
        // Calculate potential score for NEXT attempt
        const potentialScore = calculatePotentialScore(data.attempt.attempts_made);

        setGameState({
          attemptCount: data.attempt.attempts_made,
          attemptsRemaining: data.attempt.game_over ? 0 : Math.max(0, 10 - data.attempt.attempts_made),
          potentialScore: potentialScore,
          message: data.attempt.is_solved
            ? `You earned +${data.attempt.points_earned} points!`
            : data.attempt.game_over
              ? 'You\'ve used all 10 attempts'
              : 'What connects these images?',
          isGameOver: data.attempt.game_over || data.attempt.is_solved,
          isCorrect: data.attempt.is_solved,
          playersCompleted: data.challenge?.players_completed || currentChallenge?.players_completed || 0,
          uniquePlayerCount: data.challenge?.players_played || currentChallenge?.players_played || 0,
          bonuses: [],
        });
      } else if (data && !data.attempt) {
        // No attempt yet, but update challenge stats
        setGameState(prev => ({
          ...prev,
          attemptCount: 0,
          attemptsRemaining: 10,
          potentialScore: 28,
          message: 'What connects these images?',
          isGameOver: false,
          isCorrect: false,
          playersCompleted: data.challenge?.players_completed || currentChallenge?.players_completed || 0,
          uniquePlayerCount: data.challenge?.players_played || currentChallenge?.players_played || 0,
        }));
      }
    }
  });

  const isCompleted = loadData?.attempt?.is_solved || false;
  const isGameOver = loadData?.attempt?.game_over || false;
  const completedScore = loadData?.attempt?.points_earned || 0;



  // useAsync pattern: Process answer when submittedGuess changes
  const { loading: isProcessing } = useAsync(
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
        // Always reset submittedGuess to allow re-submission
        // This ensures the useAsync can be triggered again for the next guess
        setSubmittedGuess(null);

        // Handle case where result is null/undefined (error occurred)
        if (!result) {
          // Only update if we were actually processing (submittedGuess was set)
          if (submittedGuess) {
            setGameState(prev => ({
              ...prev,
              message: 'Something went wrong. Please try again.',
            }));
          }
          return;
        }

        // Update game state with attempt tracking data
        setGameState(prev => {
          // Check if this was the first attempt (attemptsRemaining went from 10 to 9)
          // If so, increment uniquePlayerCount
          const isFirstAttempt = prev.attemptsRemaining === 10 && result.attemptsRemaining < 10;

          // Build reward message (bonuses shown separately in UI)
          let rewardMessage = '';
          const bonuses = result.reward?.bonuses || [];
          if (result.isCorrect && result.reward) {
            const totalPoints = result.reward.totalPoints || result.reward.points || 0;
            rewardMessage = `+${totalPoints} points!`;

            // Trigger reward notification
            if (onReward) {
              onReward({
                type: 'challenge_solved',
                points: result.reward.points,
                experience: result.reward.experience,
                level: 0, // Level handled by separate check usually, or we could pass it if available
                message: rewardMessage,
                bonuses: bonuses,
                totalPoints: totalPoints,
              });
            }
          }

          return {
            ...prev,
            attemptCount: 10 - result.attemptsRemaining,
            attemptsRemaining: result.attemptsRemaining,
            potentialScore: result.potentialScore,
            message: result.isCorrect
              ? rewardMessage
              : result.explanation,
            isGameOver: result.gameOver,
            isCorrect: result.isCorrect,
            playersCompleted: result.isCorrect
              ? (prev.playersCompleted || 0) + 1
              : prev.playersCompleted,
            uniquePlayerCount: isFirstAttempt
              ? (prev.uniquePlayerCount || 0) + 1
              : prev.uniquePlayerCount,
            bonuses: result.reward?.bonuses || [],
          };
        });
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

  // Show loading screen when fetching next challenge
  if (isLoadingNext) {
    return (
      <vstack
        alignment="center middle"
        padding="medium"
        gap="medium"
        width="100%"
        height="100%"
        backgroundColor={BG_PRIMARY}
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

  if (!currentChallenge) {
    return (
      <vstack
        alignment="center middle"
        padding="medium"
        gap="medium"
        width="100%"
        height="100%"
        backgroundColor={BG_PRIMARY}
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
      gameState={{
        message: gameState.message,
        isGameOver: gameState.isGameOver,
        isCorrect: gameState.isCorrect,
        bonuses: gameState.bonuses,
      }}
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
      uniquePlayerCount={gameState.uniquePlayerCount}
      playersCompleted={gameState.playersCompleted}
      isLoadingNext={isLoadingNext}
    />
  );
};
