/**
 * Gameplay View Component (React)
 * Main gameplay view for playing challenges
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '../shared/Button';
import type { GameChallenge } from '../../../shared/models/challenge.types';
import type { AttemptResult } from '../../../shared/models/attempt.types';
import type { UserProfile, AnyUserProfile } from '../../../shared/models/user.types';
import { isGuestProfile } from '../../../shared/models/user.types';
import { ExplanationView } from './ExplanationView';
import { GameHeader } from './GameHeader';
import { FeedbackBubble } from './FeedbackBubble';
import { ChallengeImageGrid } from './ChallengeImageGrid';
import { EnlargedImageOverlay } from './EnlargedImageOverlay';
import { GuessInput } from './GuessInput';
import { HintConfirmDialog } from './HintConfirmDialog';
import { HintDescriptionOverlay } from './HintDescriptionOverlay';
import { GiveUpConfirmDialog } from './GiveUpConfirmDialog';
import { HowToPlayModal } from '../menu/HowToPlayModal';
import { calculateHintPenalty, calculatePotentialScore } from '../../../shared/utils/reward-calculator';
import { apiClient } from '../../api/client';
import { getButtonClasses } from '../../utils/ui-consistency';
import { LoadingSpinner, ButtonIcon } from '../shared/UIConsistencyComponents';

export interface GameplayViewProps {
  challenge: GameChallenge;
  onSubmitGuess: (guess: string) => Promise<AttemptResult>;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  onGiveUp?: (challengeId: string) => Promise<void>;
  isCreator?: boolean;
  isCompleted?: boolean;
  completedScore?: number;
  /** User's current total points for hint deduction */
  userPoints?: number;
  /** Cost per hint reveal */
  hintCost?: number;
  /** Callback to reveal a hint */
  onRevealHint?: (imageIndex: number, hintCost: number) => Promise<{ success: boolean; hint?: string; newPoints?: number; error?: string }>;
  /** Already revealed hint indices from attempt */
  initialRevealedHints?: number[];
  /** Initial attempts made (from persisted attempt) */
  initialAttemptsMade?: number;
  /** Initial game over state (from persisted attempt) */
  initialGameOver?: boolean;
  /** Initial is correct/solved state (from persisted attempt) */
  initialIsCorrect?: boolean;
  /** Current user profile (for guest registration prompts) */
  currentUser?: AnyUserProfile;
  /** Callback when registration is completed */
  onRegistrationComplete?: () => void;
  /** Whether next challenge navigation is available */
  canNavigateToNext?: boolean;
}

/** Feedback state type for gameplay */
export type FeedbackState = 'default' | 'success' | 'error' | 'warning';

/** Get feedback state based on game state */
export function getFeedbackState(
  isCompleted: boolean,
  isGameOver: boolean,
  isCorrect: boolean,
  isCreator: boolean
): FeedbackState {
  if (isCompleted || (isGameOver && isCorrect)) return 'success';
  if (isGameOver && !isCorrect) return 'error';
  if (isCreator) return 'warning';
  return 'default';
}

export function GameplayView({
  challenge,
  onSubmitGuess,
  onNextChallenge,
  onBackToMenu,
  onGiveUp,
  isCreator = false,
  isCompleted = false,
  completedScore = 0,
  userPoints = 0,
  hintCost = 10,
  onRevealHint,
  initialRevealedHints = [],
  initialAttemptsMade = 0,
  initialGameOver = false,
  initialIsCorrect = false,
  currentUser,
  onRegistrationComplete,
  canNavigateToNext = true,
}: GameplayViewProps) {
  const [message, setMessage] = useState(
    isCreator 
      ? 'Preview mode - this is your challenge!' 
      : 'What connects these images?'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGameOver, setIsGameOver] = useState(initialGameOver);
  const [isCorrect, setIsCorrect] = useState(initialIsCorrect);
  const [attemptsRemaining, setAttemptsRemaining] = useState(10 - initialAttemptsMade);
  const [potentialScore, setPotentialScore] = useState(challenge.max_score);
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  // Hint mode state
  const [hintModeActive, setHintModeActive] = useState(false);
  const [revealedHints, setRevealedHints] = useState<number[]>(initialRevealedHints);
  const [currentUserPoints, setCurrentUserPoints] = useState(userPoints);
  const [hintConfirmIndex, setHintConfirmIndex] = useState<number | null>(null);
  const [viewingHintIndex, setViewingHintIndex] = useState<number | null>(null);
  const [isRevealingHint, setIsRevealingHint] = useState(false);

  // Give up confirmation state
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [isGivingUp, setIsGivingUp] = useState(false);

  // Reward and profile state for showing achievements
  const [lastReward, setLastReward] = useState<AttemptResult['reward'] | undefined>(undefined);
  const [previousProfile, setPreviousProfile] = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [lastAttemptResult, setLastAttemptResult] = useState<AttemptResult | null>(null);

  // Guest registration prompts - completely disabled to prevent authentication popups
  // Guest users should be able to play without any registration prompts appearing
  const registrationPrompt = { show: false, trigger: 'manual' as const };

  // Sync state when initial values change (e.g., after fetching attempt from server)
  useEffect(() => {
    setRevealedHints(initialRevealedHints);
  }, [initialRevealedHints]);

  useEffect(() => {
    setAttemptsRemaining(10 - initialAttemptsMade);
  }, [initialAttemptsMade]);

  useEffect(() => {
    setIsGameOver(initialGameOver);
  }, [initialGameOver]);

  useEffect(() => {
    setIsCorrect(initialIsCorrect);
  }, [initialIsCorrect]);

  // Sync potential score based on attempts and hints
  useEffect(() => {
    const totalImages = challenge.images?.length || 3;
    const score = calculatePotentialScore(initialAttemptsMade, initialRevealedHints.length, totalImages);
    setPotentialScore(score);
  }, [initialAttemptsMade, initialRevealedHints.length, challenge.images?.length]);

  // Update message when game state is restored
  useEffect(() => {
    if (initialIsCorrect) {
      setMessage('You already solved this challenge!');
    } else if (initialGameOver) {
      setMessage('Game over! Better luck next time.');
    } else if (initialAttemptsMade > 0) {
      setMessage(`Welcome back! ${10 - initialAttemptsMade} attempts remaining.`);
    }
  }, [initialIsCorrect, initialGameOver, initialAttemptsMade]);

  // Calculate the cost for the next hint based on how many have been revealed
  const totalImages = challenge.images?.length || 0;
  const nextHintNumber = revealedHints.length + 1;
  const currentHintCost = useMemo(() => {
    return calculateHintPenalty(totalImages, nextHintNumber);
  }, [totalImages, nextHintNumber]);

  const handleAnswerSubmit = useCallback(async (guess: string) => {
    if (isSubmitting || isGameOver || isCreator || isCompleted) {
      return;
    }

    setIsSubmitting(true);
    setMessage('Checking your answer...');

    try {
      // Capture profile before submission to detect newly unlocked badges
      const profileBefore = await apiClient.getUserProfile().catch(() => null);
      setPreviousProfile(profileBefore);

      const result = await onSubmitGuess(guess);

      setAttemptsRemaining(result.attemptsRemaining);
      setPotentialScore(result.potentialScore);
      setIsGameOver(result.gameOver);
      setIsCorrect(result.isCorrect);
      setMessage(result.explanation);
      setLastAttemptResult(result); // Store for registration prompts

      // If correct, store reward and fetch updated profile
      if (result.isCorrect && result.reward) {
        setLastReward(result.reward);
        // Fetch updated profile to detect newly unlocked badges
        const profileAfter = await apiClient.getUserProfile().catch(() => null);
        setCurrentProfile(profileAfter);
      }
    } catch (error) {
      console.error('Error submitting guess:', error);
      setMessage('Failed to submit guess. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isGameOver, isCreator, isCompleted, onSubmitGuess]);

  const handleEnlargeImage = useCallback((index: number) => {
    setEnlargedImageIndex(index);
  }, []);

  const handleCloseEnlarged = useCallback(() => {
    setEnlargedImageIndex(null);
  }, []);

  // Hint mode handlers
  const handleToggleHintMode = useCallback(() => {
    setHintModeActive((prev) => !prev);
  }, []);

  const handleHintImageClick = useCallback((index: number) => {
    // Open confirmation dialog for this image
    setHintConfirmIndex(index);
  }, []);

  const handleConfirmHint = useCallback(async () => {
    if (hintConfirmIndex === null || !onRevealHint) return;

    setIsRevealingHint(true);
    try {
      const result = await onRevealHint(hintConfirmIndex, currentHintCost);
      
      if (result.success) {
        setRevealedHints((prev) => [...prev, hintConfirmIndex]);
        if (result.newPoints !== undefined) {
          setCurrentUserPoints(result.newPoints);
        }
        // Close confirm dialog and show the hint
        setHintConfirmIndex(null);
        setViewingHintIndex(hintConfirmIndex);
        setHintModeActive(false);
      } else {
        setMessage(result.error || 'Failed to reveal hint');
        setHintConfirmIndex(null);
      }
    } catch (error) {
      console.error('Error revealing hint:', error);
      setMessage('Failed to reveal hint. Please try again.');
      setHintConfirmIndex(null);
    } finally {
      setIsRevealingHint(false);
    }
  }, [hintConfirmIndex, onRevealHint, currentHintCost]);

  const handleCancelHint = useCallback(() => {
    setHintConfirmIndex(null);
  }, []);

  const handleViewRevealedHint = useCallback((index: number) => {
    setViewingHintIndex(index);
  }, []);

  const handleCloseHintView = useCallback(() => {
    setViewingHintIndex(null);
  }, []);

  const handleGiveUp = useCallback(async () => {
    if (!onGiveUp || isGameOver || isCompleted || isCreator) return;

    setIsGivingUp(true);
    try {
      setMessage('Giving up...');
      await onGiveUp(challenge.id);
      setIsGameOver(true);
      setIsCorrect(false);
      setAttemptsRemaining(0);
      setMessage('You gave up on this challenge. Better luck next time!');
      setShowGiveUpConfirm(false);
    } catch (error) {
      console.error('Error giving up:', error);
      setMessage('Failed to give up. Please try again.');
    } finally {
      setIsGivingUp(false);
    }
  }, [onGiveUp, isGameOver, isCompleted, isCreator, challenge.id]);

  const handleShowGiveUpConfirm = useCallback(() => {
    setShowGiveUpConfirm(true);
  }, []);

  const handleCancelGiveUp = useCallback(() => {
    setShowGiveUpConfirm(false);
  }, []);

  // Explanation view
  if (showExplanation) {
    return (
      <ExplanationView
        challenge={challenge}
        onClose={() => setShowExplanation(false)}
      />
    );
  }

  const images = challenge.images || [];

  return (
    <div className="w-full h-full max-h-full bg-[#FFF8F0] dark:bg-[#0f1419] flex flex-col overflow-hidden relative font-sans text-sm text-neutral-900 dark:text-white/95">
      {/* Header Section */}
      <GameHeader
        challenge={challenge}
        potentialScore={potentialScore}
        attemptsRemaining={attemptsRemaining}
        onBackToMenu={onBackToMenu}
        onInfoClick={() => setShowHowToPlay(true)}
        userPoints={currentUserPoints}
      />

      {/* How to Play Modal */}
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />

      {/* Enlarged Image Overlay */}
      {enlargedImageIndex !== null && challenge.images && (
        <EnlargedImageOverlay
          image={challenge.images[enlargedImageIndex]}
          onClose={handleCloseEnlarged}
        />
      )}

      {/* Give Up Confirm Dialog */}
      {showGiveUpConfirm && (
        <GiveUpConfirmDialog
          isOpen={true}
          onClose={handleCancelGiveUp}
          onConfirm={handleGiveUp}
          isLoading={isGivingUp}
        />
      )}

      {/* Hint Confirm Dialog */}
      {hintConfirmIndex !== null && (
        <HintConfirmDialog
          isOpen={true}
          onClose={handleCancelHint}
          onConfirm={handleConfirmHint}
          imageIndex={hintConfirmIndex}
          hintCost={currentHintCost}
          userPoints={currentUserPoints}
          isLoading={isRevealingHint}
        />
      )}

      {/* Hint Description Overlay */}
      {viewingHintIndex !== null && challenge.images && challenge.images[viewingHintIndex] && (
        <HintDescriptionOverlay
          image={challenge.images[viewingHintIndex]}
          imageIndex={viewingHintIndex}
          onClose={handleCloseHintView}
        />
      )}

      {/* Content: Grid + Chat */}
      <div className="flex-1 flex flex-col items-center px-4 py-2 gap-2 overflow-y-auto w-full min-h-0">
        {/* Image Grid */}
        <ChallengeImageGrid
          images={images}
          onEnlargeImage={handleEnlargeImage}
          hintModeActive={hintModeActive}
          onHintImageClick={handleHintImageClick}
          revealedHints={revealedHints}
          onViewRevealedHint={handleViewRevealedHint}
        />

        {/* Hint, Give Up, and Next Buttons - positioned between images and feedback */}
        {!isGameOver && !isCompleted && !isCreator && (
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Hint Button */}
              {onRevealHint && (
                <button
                  onClick={handleToggleHintMode}
                  className={getButtonClasses(
                    hintModeActive ? 'primary' : 'actionHint',
                    'sm'
                  )}
                  aria-pressed={hintModeActive}
                  aria-label={hintModeActive ? 'Cancel hint mode' : 'Enter hint mode'}
                >
                  <ButtonIcon>
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                    </svg>
                  </ButtonIcon>
                  {hintModeActive ? 'Cancel' : 'Hint'}
                </button>
              )}
              
              {/* Next Button */}
              <button
                onClick={onNextChallenge}
                disabled={!canNavigateToNext}
                title={canNavigateToNext ? "Navigate to next challenge" : "No more challenges available"}
                className={getButtonClasses(
                  canNavigateToNext ? 'actionNext' : 'action',
                  'sm',
                  false,
                  false,
                  !canNavigateToNext ? 'opacity-50 cursor-not-allowed' : ''
                )}
                aria-label="Navigate to next challenge"
              >
                <ButtonIcon>
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </ButtonIcon>
                Next
              </button>
              
              {/* Give Up Button */}
              {onGiveUp && (
                <button
                  onClick={handleShowGiveUpConfirm}
                  disabled={isGivingUp}
                  className={getButtonClasses('actionDanger', 'sm')}
                  aria-label="Give up on current challenge"
                >
                  {isGivingUp ? (
                    <LoadingSpinner size="xs" />
                  ) : (
                    <ButtonIcon>
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </ButtonIcon>
                  )}
                  {isGivingUp ? 'Giving Up...' : 'Give Up'}
                </button>
              )}
            </div>
            
            {hintModeActive && onRevealHint && (
              <p className="text-xs text-center text-neutral-500 dark:text-white/50 mt-1">
                Tap an image to reveal its description
              </p>
            )}
          </div>
        )}

        {/* Chat / Feedback */}
        <FeedbackBubble
          message={message}
          creatorAvatarUrl={challenge.creator_avatar_url}
          creatorUsername={challenge.creator_username}
          isCorrect={isCorrect}
          isGameOver={isGameOver}
          reward={lastReward}
          previousProfile={previousProfile}
          currentProfile={currentProfile}
          isCreatorGuest={challenge.creator_username.startsWith('guest_')}
        />

        {/* Guest Registration Prompt - Completely disabled to prevent authentication popups */}
        {/* Guest users should be able to play the full game without any registration prompts */}

        {/* Action Buttons (Retry/Next) if Game Over */}
        {(isGameOver || isCompleted) && (
          <div className="w-full max-w-[360px] flex gap-2.5">
            {challenge.answer_explanation && (
              <Button variant="secondary" fullWidth onClick={() => setShowExplanation(true)}>
                Explain
              </Button>
            )}
            <Button variant="primary" fullWidth onClick={onNextChallenge}>
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Creator Notice */}
      {isCreator && !isGameOver && !isCompleted && (
        <div className="w-full px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border-t border-amber-200 dark:border-amber-500/20 flex-shrink-0">
          <div className="max-w-[500px] mx-auto flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This is your challenge. You can preview it, but you cannot submit answers to your own puzzles.
            </p>
          </div>
        </div>
      )}

      {/* Sticky Footer Input */}
      {!isGameOver && !isCompleted && !isCreator && (
        <GuessInput 
          onSubmit={handleAnswerSubmit} 
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
