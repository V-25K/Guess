/**
 * GuessInput Component
 * Input form for submitting guesses in the gameplay view
 */

import React from 'react';

export interface GuessInputProps {
  onSubmit: (guess: string) => void;
  isSubmitting: boolean;
  /** Whether to use compact sizing for inline mode */
  compact?: boolean;
}

export const GuessInput: React.FC<GuessInputProps> = ({
  onSubmit,
  isSubmitting,
  compact = false,
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('guess') as HTMLInputElement;
    if (input && input.value.trim() && !isSubmitting) {
      onSubmit(input.value.trim());
      input.value = '';
    }
  };

  return (
    <div className={`w-full bg-white dark:bg-[#243044] border-t border-neutral-200 dark:border-white/[0.12] flex-shrink-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)] ${compact ? 'px-2 py-1 pb-[max(4px,env(safe-area-inset-bottom))]' : 'px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]'}`}>
      <div className="w-full max-w-[500px] mx-auto">
        <form
          className="flex gap-2 w-full"
          onSubmit={handleSubmit}
        >
          <input
            className={`flex-1 rounded-full border border-neutral-200 dark:border-white/[0.12] bg-neutral-50 dark:bg-[#1a2332] text-neutral-900 dark:text-white/95 outline-none transition-colors duration-200 motion-reduce:transition-none focus:border-game-primary dark:focus:border-[#f0d078] focus:ring-2 focus:ring-game-primary/20 dark:focus:ring-[#f0d078]/20 placeholder:text-neutral-400 dark:placeholder:text-white/30 ${compact ? 'py-1.5 px-3 text-xs' : 'py-2.5 px-4 text-sm min-h-touch'}`}
            placeholder="Type your guess..."
            name="guess"
            autoComplete="off"
            aria-label="Enter your guess"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className={`rounded-full border-none bg-game-primary dark:bg-gradient-to-r dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#1a2332] font-bold flex items-center justify-center cursor-pointer flex-shrink-0 shadow-md dark:shadow-[0_4px_12px_rgba(240,208,120,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-game-primary-hover dark:hover:from-[#e4b85b] dark:hover:to-[#fff088] focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] focus:ring-offset-2 dark:focus:ring-offset-[#243044] transition-all duration-200 ${compact ? 'w-[32px] h-[32px] text-sm' : 'w-[42px] h-[42px] text-lg min-h-touch min-w-touch'}`}
            disabled={isSubmitting}
            aria-label="Submit guess"
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
};
