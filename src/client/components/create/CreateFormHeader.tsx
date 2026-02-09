/**
 * CreateFormHeader Component
 * Header for the challenge creation form
 */

import React from 'react';

export interface CreateFormHeaderProps {
  onCancel?: () => void;
}

export const CreateFormHeader: React.FC<CreateFormHeaderProps> = ({
  onCancel,
}) => {
  return (
    <div className="py-3 px-4 bg-white dark:bg-[#1a2332] border-b border-neutral-200 dark:border-white/[0.08] flex items-center justify-between flex-shrink-0 h-[60px]">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white/95 m-0">Create Challenge</h2>
      </div>
      <button
        onClick={onCancel}
        className="bg-transparent border-none text-neutral-500 dark:text-white/50 text-2xl p-0 cursor-pointer flex items-center justify-center w-8 h-8 min-h-touch min-w-touch hover:text-neutral-900 dark:hover:text-white/95 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] rounded-lg transition-colors"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
};
