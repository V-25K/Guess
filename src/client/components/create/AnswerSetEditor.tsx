/**
 * AnswerSetEditor Component
 * Minimal list-based editor for correct and close answers
 */

import React, { useState } from 'react';

export interface AnswerSetEditorProps {
  correctAnswers: string[];
  closeAnswers: string[];
  onCorrectChange: (answers: string[]) => void;
  onCloseChange: (answers: string[]) => void;
}

interface AnswerListProps {
  title: string;
  answers: string[];
  onRemove: (index: number) => void;
  onAdd: (answer: string) => void;
  colorClass: 'emerald' | 'amber';
  placeholder: string;
}

const AnswerList: React.FC<AnswerListProps> = ({
  title,
  answers,
  onRemove,
  onAdd,
  colorClass,
  placeholder,
}) => {
  const [newAnswer, setNewAnswer] = useState('');

  const colors = {
    emerald: {
      title: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
      focus: 'focus:ring-emerald-500',
      btn: 'bg-emerald-500 hover:bg-emerald-600',
    },
    amber: {
      title: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/20',
      hover: 'hover:bg-amber-100 dark:hover:bg-amber-500/20',
      focus: 'focus:ring-amber-500',
      btn: 'bg-amber-500 hover:bg-amber-600',
    },
  };

  const c = colors[colorClass];

  const handleAdd = () => {
    const trimmed = newAnswer.trim().toLowerCase();
    if (trimmed && !answers.includes(trimmed)) {
      onAdd(trimmed);
      setNewAnswer('');
    }
  };

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} overflow-hidden`}>
      <div className={`px-3 py-2 border-b ${c.border} flex items-center justify-between`}>
        <span className={`text-sm font-semibold ${c.title}`}>{title}</span>
        <span className="text-xs text-neutral-500 dark:text-white/50">{answers.length} items</span>
      </div>
      
      <ul className="divide-y divide-neutral-200 dark:divide-white/[0.08] max-h-[200px] overflow-y-auto">
        {answers.length === 0 ? (
          <li className="px-3 py-2 text-sm text-neutral-400 dark:text-white/30 italic">
            No answers yet
          </li>
        ) : (
          answers.map((answer, idx) => (
            <li
              key={idx}
              className={`px-3 py-2 flex items-center justify-between group ${c.hover} transition-colors`}
            >
              <span className="text-sm text-neutral-700 dark:text-white/80">{answer}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 transition-all"
                aria-label={`Remove ${answer}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))
        )}
      </ul>

      <div className={`px-3 py-2 border-t ${c.border} flex gap-2`}>
        <input
          type="text"
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className={`flex-1 px-2 py-1.5 text-sm rounded border border-neutral-200 dark:border-white/[0.12] bg-white dark:bg-[#0f1419] focus:outline-none focus:ring-2 ${c.focus}`}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newAnswer.trim()}
          className={`px-3 py-1.5 ${c.btn} text-white text-xs font-semibold rounded disabled:opacity-50 transition-colors`}
        >
          Add
        </button>
      </div>
    </div>
  );
};

export const AnswerSetEditor: React.FC<AnswerSetEditorProps> = ({
  correctAnswers,
  closeAnswers,
  onCorrectChange,
  onCloseChange,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <AnswerList
        title="✓ Correct Answers"
        answers={correctAnswers}
        onRemove={(idx) => onCorrectChange(correctAnswers.filter((_, i) => i !== idx))}
        onAdd={(answer) => onCorrectChange([...correctAnswers, answer])}
        colorClass="emerald"
        placeholder="Add correct answer..."
      />
      <AnswerList
        title="~ Close Answers"
        answers={closeAnswers}
        onRemove={(idx) => onCloseChange(closeAnswers.filter((_, i) => i !== idx))}
        onAdd={(answer) => onCloseChange([...closeAnswers, answer])}
        colorClass="amber"
        placeholder="Add close answer..."
      />
    </div>
  );
};
