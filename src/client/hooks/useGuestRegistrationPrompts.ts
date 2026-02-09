/**
 * useGuestRegistrationPrompts Hook
 * Manages when to show registration prompts to guest users
 * 
 * Requirements: REQ-1.4, REQ-7.4
 */

import { useState, useEffect } from 'react';
import type { GuestProfile } from '../../shared/models/user.types';
import type { AttemptResult } from '../../shared/models/attempt.types';

export interface RegistrationPromptTrigger {
  show: boolean;
  trigger: 'achievement' | 'level-up' | 'streak' | 'manual';
  message?: string;
}

export interface UseGuestRegistrationPromptsProps {
  guestProfile: GuestProfile;
  lastAttemptResult?: AttemptResult | null;
}

/**
 * Hook to determine when to show registration prompts to guest users
 */
export function useGuestRegistrationPrompts({
  guestProfile,
  lastAttemptResult,
}: UseGuestRegistrationPromptsProps): RegistrationPromptTrigger {
  const [promptState, setPromptState] = useState<RegistrationPromptTrigger>({
    show: false,
    trigger: 'manual',
  });

  const [lastPromptTime, setLastPromptTime] = useState<number>(0);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());

  // Minimum time between prompts (5 minutes)
  const PROMPT_COOLDOWN = 5 * 60 * 1000;

  useEffect(() => {
    // Don't show prompts if we don't have a valid guest profile
    if (!guestProfile || !guestProfile.id || !guestProfile.username) {
      setPromptState({ show: false, trigger: 'manual' });
      return;
    }

    const now = Date.now();
    
    // Don't show prompts too frequently
    if (now - lastPromptTime < PROMPT_COOLDOWN) {
      return;
    }

    // Check for level up
    if (lastAttemptResult?.isCorrect && lastAttemptResult?.levelUp) {
      const promptKey = `level-up-${guestProfile.level}`;
      if (!dismissedPrompts.has(promptKey)) {
        setPromptState({
          show: true,
          trigger: 'level-up',
          message: `You reached Level ${guestProfile.level}! Create an account to keep your progress safe.`,
        });
        setLastPromptTime(now);
        return;
      }
    }

    // Check for streak achievements
    if (guestProfile.current_streak >= 5 && guestProfile.current_streak % 5 === 0) {
      const promptKey = `streak-${guestProfile.current_streak}`;
      if (!dismissedPrompts.has(promptKey)) {
        setPromptState({
          show: true,
          trigger: 'streak',
          message: `${guestProfile.current_streak}-challenge streak! Don't lose your progress - create an account now.`,
        });
        setLastPromptTime(now);
        return;
      }
    }

    // Check for point milestones
    const pointMilestones = [100, 250, 500, 1000, 2000];
    const currentMilestone = pointMilestones.find(
      milestone => guestProfile.total_points >= milestone && 
      guestProfile.total_points < milestone + 50 // Show only near the milestone
    );

    if (currentMilestone) {
      const promptKey = `points-${currentMilestone}`;
      if (!dismissedPrompts.has(promptKey)) {
        setPromptState({
          show: true,
          trigger: 'achievement',
          message: `${currentMilestone} points earned! Create an account to save your achievements forever.`,
        });
        setLastPromptTime(now);
        return;
      }
    }

    // Check for challenges solved milestones
    const solvedMilestones = [5, 10, 25, 50];
    const currentSolvedMilestone = solvedMilestones.find(
      milestone => guestProfile.challenges_solved >= milestone &&
      guestProfile.challenges_solved < milestone + 2 // Show only near the milestone
    );

    if (currentSolvedMilestone) {
      const promptKey = `solved-${currentSolvedMilestone}`;
      if (!dismissedPrompts.has(promptKey)) {
        setPromptState({
          show: true,
          trigger: 'achievement',
          message: `${currentSolvedMilestone} challenges solved! Create an account to compete globally.`,
        });
        setLastPromptTime(now);
        return;
      }
    }

    // Default: show manual prompt for users with significant progress
    if (guestProfile.total_points >= 50 && guestProfile.challenges_solved >= 2) {
      const promptKey = 'manual-general';
      if (!dismissedPrompts.has(promptKey)) {
        setPromptState({
          show: true,
          trigger: 'manual',
          message: 'Create an account to save your progress and compete on the global leaderboard!',
        });
        setLastPromptTime(now);
        return;
      }
    }

    // No prompt to show
    setPromptState({ show: false, trigger: 'manual' });
  }, [guestProfile, lastAttemptResult, lastPromptTime, dismissedPrompts]);

  // Function to dismiss a prompt
  const dismissPrompt = (trigger: string, customKey?: string) => {
    const promptKey = customKey || `${trigger}-${Date.now()}`;
    setDismissedPrompts(prev => new Set([...prev, promptKey]));
    setPromptState({ show: false, trigger: 'manual' });
  };

  return {
    ...promptState,
    dismissPrompt,
  } as RegistrationPromptTrigger & { dismissPrompt: (trigger: string, customKey?: string) => void };
}