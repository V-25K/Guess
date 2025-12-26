/**
 * ChallengeDetailsForm Component
 * Form fields for challenge title, answer, and explanation
 */

import React from 'react';

export interface ChallengeDetailsFormProps {
  title: string;
  answer: string;
  answerExplanation: string;
  onTitleChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onExplanationChange: (value: string) => void;
}

export const ChallengeDetailsForm: React.FC<ChallengeDetailsFormProps> = ({
  title,
  answer,
  answerExplanation,
  onTitleChange,
  onAnswerChange,
  onExplanationChange,
}) => {
  return (
    <div className="bg-white dark:bg-[#1a2332] rounded-xl p-4 flex flex-col gap-3 border border-neutral-200 dark:border-white/[0.08]">
      <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white/95 m-0">Details</h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="challenge-title" className="text-xs text-neutral-500 dark:text-white/50 font-medium">Title</label>
        <input
          id="challenge-title"
          type="text"
          className="py-2.5 px-3 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-neutral-50 dark:bg-[#243044] text-neutral-900 dark:text-white/95 text-sm w-full font-sans transition-colors duration-200 min-h-touch focus:outline-none focus:border-game-primary dark:focus:border-[#f0d078] focus:ring-2 focus:ring-game-primary/20 dark:focus:ring-[#f0d078]/20 placeholder:text-neutral-400 dark:placeholder:text-white/30"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Guess the Movie"
          aria-label="Challenge title"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="challenge-answer" className="text-xs text-neutral-500 dark:text-white/50 font-medium">Correct Answer</label>
        <input
          id="challenge-answer"
          type="text"
          className="py-2.5 px-3 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-neutral-50 dark:bg-[#243044] text-neutral-900 dark:text-white/95 text-sm w-full font-sans transition-colors duration-200 min-h-touch focus:outline-none focus:border-game-primary dark:focus:border-[#f0d078] focus:ring-2 focus:ring-game-primary/20 dark:focus:ring-[#f0d078]/20 placeholder:text-neutral-400 dark:placeholder:text-white/30"
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="e.g. Inception"
          aria-label="Correct answer"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="challenge-explanation" className="text-xs text-neutral-500 dark:text-white/50 font-medium">Answer Explanation</label>
        <textarea
          id="challenge-explanation"
          className="py-2.5 px-3 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-neutral-50 dark:bg-[#243044] text-neutral-900 dark:text-white/95 text-sm w-full font-sans transition-colors duration-200 resize-none min-h-[80px] focus:outline-none focus:border-game-primary dark:focus:border-[#f0d078] focus:ring-2 focus:ring-game-primary/20 dark:focus:ring-[#f0d078]/20 placeholder:text-neutral-400 dark:placeholder:text-white/30"
          value={answerExplanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          placeholder="Explain the connection between images and answer..."
          rows={3}
          aria-label="Answer explanation"
        />
      </div>
    </div>
  );
};
