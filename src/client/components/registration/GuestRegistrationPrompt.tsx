/**
 * Guest Registration Prompt Component
 * Inline prompt encouraging guest users to register
 * 
 * Requirements: REQ-1.4, REQ-7.4
 */

import { useState } from 'react';
import { Button } from '../shared/Button';
import { GuestRegistrationModal } from './GuestRegistrationModal';
import type { GuestProfile } from '../../../shared/models/user.types';

export interface GuestRegistrationPromptProps {
  guestProfile: GuestProfile;
  onRegistrationComplete: () => void;
  /** When to show the prompt */
  trigger: 'achievement' | 'level-up' | 'streak' | 'manual';
  /** Custom message for the prompt */
  message?: string;
  /** Whether to show as a banner or inline */
  variant?: 'banner' | 'inline';
}

const TRIGGER_MESSAGES = {
  achievement: "Great job! Create an account to save your achievements forever.",
  'level-up': "You leveled up! Create an account to keep your progress safe.",
  streak: "Amazing streak! Don't lose your progress - create an account now.",
  manual: "Create an account to save your progress and compete globally.",
};

export function GuestRegistrationPrompt({
  guestProfile,
  onRegistrationComplete,
  trigger,
  message,
  variant = 'inline',
}: GuestRegistrationPromptProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const promptMessage = message || TRIGGER_MESSAGES[trigger];

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleRegistrationComplete = () => {
    setIsModalOpen(false);
    onRegistrationComplete();
  };

  if (variant === 'banner') {
    return (
      <>
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                🎯
              </div>
              <div>
                <p className="font-medium">{promptMessage}</p>
                <p className="text-sm opacity-90">
                  {guestProfile.total_points} points • Level {guestProfile.level}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDismiss}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                Later
              </Button>
              <Button
                size="sm"
                onClick={handleOpenModal}
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>

        <GuestRegistrationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onRegistrationComplete={handleRegistrationComplete}
          guestProfile={guestProfile}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            💡
          </div>
          <div className="flex-1">
            <p className="text-blue-900 font-medium text-sm mb-1">
              {promptMessage}
            </p>
            <p className="text-blue-700 text-xs mb-3">
              Your progress: {guestProfile.total_points} points, Level {guestProfile.level}
            </p>
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={handleOpenModal}
                className="text-xs"
              >
                Create Account
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDismiss}
                className="text-xs"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GuestRegistrationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onRegistrationComplete={handleRegistrationComplete}
        guestProfile={guestProfile}
      />
    </>
  );
}