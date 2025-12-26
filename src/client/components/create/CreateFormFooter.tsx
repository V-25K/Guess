/**
 * CreateFormFooter Component
 * Sticky footer with cancel and submit buttons for challenge creation
 */

import React from 'react';

export interface CreateFormFooterProps {
  onCancel?: () => void;
  onSubmit: (e?: React.FormEvent | React.MouseEvent) => void;
  isSubmitting: boolean;
}

export const CreateFormFooter: React.FC<CreateFormFooterProps> = ({
  onCancel,
  onSubmit,
  isSubmitting,
}) => {
  return (
    <div className="p-4 bg-white dark:bg-[#1a2332] border-t border-neutral-200 dark:border-white/[0.08] flex gap-3 fixed bottom-[60px] left-0 right-0 z-10 pb-[max(16px,env(safe-area-inset-bottom))]">
      <button
        className="flex-1 bg-transparent text-neutral-700 dark:text-white/70 border border-neutral-200 dark:border-white/[0.12] rounded-full py-3 font-semibold text-[15px] cursor-pointer flex items-center justify-center min-h-touch hover:bg-neutral-50 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        className="flex-1 bg-game-primary dark:bg-gradient-to-r dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#0f1419] border-none rounded-full py-3 font-bold text-[15px] cursor-pointer flex items-center justify-center min-h-touch hover:bg-game-primary-hover dark:hover:from-[#e4b85b] dark:hover:to-[#f5dc8c] focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        onClick={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Posting...' : 'Post Challenge'}
      </button>
    </div>
  );
};
