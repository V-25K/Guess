/**
 * Give Up Confirm Dialog Component
 * Modal dialog to confirm giving up on a challenge
 */

import React from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';

export interface GiveUpConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when give up is confirmed */
  onConfirm: () => void;
  /** Whether the give up action is loading */
  isLoading?: boolean;
}

export function GiveUpConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: GiveUpConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Give Up Challenge?"
      size="sm"
      closeOnOverlayClick={!isLoading}
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-white/70">
          Are you sure you want to give up? This will end the challenge and reset your streak.
        </p>
        
        <div className="flex gap-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onConfirm}
            disabled={isLoading}
            className="!bg-red-500 hover:!bg-red-600 dark:!bg-red-600 dark:hover:!bg-red-700"
          >
            {isLoading ? 'Giving Up...' : 'Give Up'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}