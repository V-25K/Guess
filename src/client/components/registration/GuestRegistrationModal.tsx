/**
 * Guest Registration Modal Component
 * Modal for converting guest users to authenticated users
 * 
 * Requirements: REQ-1.4, REQ-7.4
 */

import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { userAuthService } from '../../services/user-auth.service';
import type { GuestProfile } from '../../../shared/models/user.types';

export interface GuestRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistrationComplete: () => void;
  guestProfile: GuestProfile;
}

export function GuestRegistrationModal({
  isOpen,
  onClose,
  onRegistrationComplete,
  guestProfile,
}: GuestRegistrationModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    try {
      setIsRegistering(true);
      setError(null);

      // In a real implementation, this would redirect to Reddit OAuth
      // For now, we'll simulate the registration process
      console.log('Starting registration process for guest:', guestProfile.id);
      
      // This would typically:
      // 1. Redirect to Reddit OAuth
      // 2. On return, migrate guest data to authenticated user
      // 3. Clear guest data from local storage
      
      // For demo purposes, we'll just show success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onRegistrationComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Your Account">
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-2xl">
            👤
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Save Your Progress Forever
          </h3>
          <p className="text-gray-600 text-sm">
            Create a Reddit account to permanently save your progress and compete on the global leaderboard.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Your Current Progress:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Points:</span>
              <span className="font-semibold ml-1">{guestProfile.total_points}</span>
            </div>
            <div>
              <span className="text-blue-700">Level:</span>
              <span className="font-semibold ml-1">{guestProfile.level}</span>
            </div>
            <div>
              <span className="text-blue-700">Solved:</span>
              <span className="font-semibold ml-1">{guestProfile.challenges_solved}</span>
            </div>
            <div>
              <span className="text-blue-700">Best Streak:</span>
              <span className="font-semibold ml-1">{guestProfile.best_streak}</span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Benefits of Creating an Account:</h4>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Permanent progress saving across devices</li>
            <li>• Compete on the global leaderboard</li>
            <li>• Create and share your own challenges</li>
            <li>• Unlock exclusive badges and achievements</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isRegistering}
            className="flex-1"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleRegister}
            disabled={isRegistering}
            className="flex-1"
          >
            {isRegistering ? 'Creating Account...' : 'Create Account'}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          By creating an account, you agree to Reddit's Terms of Service and Privacy Policy.
        </p>
      </div>
    </Modal>
  );
}