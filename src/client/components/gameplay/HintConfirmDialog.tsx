/**
 * HintConfirmDialog Component
 * Confirmation dialog for revealing image hints with point deduction
 */

import React from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';

export interface HintConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  imageIndex: number;
  hintCost: number;
  userPoints: number;
  isLoading?: boolean;
}

export function HintConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  imageIndex,
  hintCost,
  userPoints,
  isLoading = false,
}: HintConfirmDialogProps) {
  const canAfford = userPoints >= hintCost;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reveal Hint" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-neutral-700 dark:text-white/80 text-sm leading-relaxed">
          Reveal the description for Image {imageIndex + 1}?
        </p>
        
        <div className="bg-neutral-100 dark:bg-[#243044] rounded-lg p-3 flex flex-col gap-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-600 dark:text-white/60">Cost:</span>
            <span className="font-semibold text-game-primary dark:text-[#f0d078]">
              -{hintCost} points
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-600 dark:text-white/60">Your points:</span>
            <span className={`font-semibold ${canAfford ? 'text-neutral-900 dark:text-white' : 'text-red-500'}`}>
              {userPoints}
            </span>
          </div>
          {!canAfford && (
            <p className="text-red-500 text-xs mt-1">
              Not enough points to reveal this hint.
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={onConfirm}
            disabled={!canAfford || isLoading}
            loading={isLoading}
          >
            Reveal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
