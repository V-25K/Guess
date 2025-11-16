/**
 * Gameplay View Wrapper Component
 * Wraps PlayGameView with form logic and state management
 * 
 * FIX: Creates services fresh in each form submission to ensure proper async context
 */

import { Devvit, useForm } from '@devvit/public-api';
import { PlayGameView } from './PlayGameView.js';
import type { GameChallenge } from '../../../shared/models/challenge.types.js';
import { AIValidationService } from '../../../server/services/ai-validation.service.js';
import { AttemptService } from '../../../server/services/attempt.service.js';
import { UserService } from '../../../server/services/user.service.js';
import { AttemptRepository } from '../../../server/repositories/attempt.repository.js';
import { UserRepository } from '../../../server/repositories/user.repository.js';

export interface GameplayViewWrapperProps {
  userId: string;
  currentChallenge: GameChallenge | null;
  challenges: GameChallenge[];
  currentChallengeIndex: number;
  gameState: {
    revealedCount: number;
    score: number;
    message: string;
    isGameOver: boolean;
  };
  onRevealImage: (index: number) => void;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  setGameState: (state: any) => void;
}

/**
 * Gameplay View Wrapper
 * Handles answer form submission and game logic
 */
export const GameplayViewWrapper: Devvit.BlockComponent<GameplayViewWrapperProps> = (
  {
    userId,
    currentChallenge,
    challenges,
    currentChallengeIndex,
    gameState,
    onRevealImage,
    onNextChallenge,
    onBackToMenu,
    setGameState,
  },
  context
) => {
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

      const answer = values.answer;

      try {
        const aiValidationService = new AIValidationService(context);
        const attemptRepo = new AttemptRepository(context);
        const userRepo = new UserRepository(context);
        const userService = new UserService(context, userRepo);
        const attemptService = new AttemptService(context, attemptRepo, userService);

        const validationResult = await aiValidationService.validateAnswer(answer, currentChallenge);

        if (validationResult.isCorrect) {
          const result = await attemptService.submitGuess(
            userId,
            currentChallenge.id,
            true,
            gameState.revealedCount
          );

          setGameState((prev: any) => ({
            ...prev,
            isGameOver: true,
            message: `🎉 Correct! You earned +${result.reward?.points || 0} points!`,
          }));

          context.ui.showToast('🎉 Correct answer!');
        } else {
          const explanation = validationResult.explanation || 'Not quite right. Try again!';

          setGameState((prev: any) => ({
            ...prev,
            message: `❌ ${explanation}`,
          }));
        }
      } catch (error) {
        console.error('Error during answer submission:', error);
        setGameState((prev: any) => ({
          ...prev,
          message: '⚠️ Error checking answer. Please try again.',
        }));
      }
    }
  );

  const handleOpenAnswerForm = () => {
    context.ui.showForm(answerForm);
  };

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
      onRevealImage={onRevealImage}
      onSubmitAnswer={handleOpenAnswerForm}
      onNextChallenge={onNextChallenge}
      onBackToMenu={onBackToMenu}
    />
  );
};
