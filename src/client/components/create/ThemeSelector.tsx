/**
 * ThemeSelector Component
 * Selectable theme chips for categorizing challenges with custom theme creation
 */

import React, { useState } from 'react';

export const AVAILABLE_THEMES = [
  'Movies', 'Music', 'Sports', 'Gaming', 'History',
  'Science', 'Geography', 'Technology', 'Literature', 'Food'
];

export interface ThemeSelectorProps {
  selectedThemes: string[];
  onToggleTheme: (theme: string) => void;
  maxThemes?: number;
  customThemes?: string[];
  onAddCustomTheme?: (theme: string) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  selectedThemes,
  onToggleTheme,
  maxThemes = 3,
  customThemes = [],
  onAddCustomTheme,
}) => {
  const [newTheme, setNewTheme] = useState('');
  const [showInput, setShowInput] = useState(false);

  const allThemes = [...AVAILABLE_THEMES, ...customThemes.filter(t => !AVAILABLE_THEMES.includes(t))];

  const handleToggle = (theme: string) => {
    if (selectedThemes.includes(theme)) {
      onToggleTheme(theme);
    } else if (selectedThemes.length < maxThemes) {
      onToggleTheme(theme);
    }
  };

  const handleAddTheme = () => {
    const trimmed = newTheme.trim();
    if (trimmed && !allThemes.includes(trimmed) && onAddCustomTheme) {
      onAddCustomTheme(trimmed);
      if (selectedThemes.length < maxThemes) {
        onToggleTheme(trimmed);
      }
    }
    setNewTheme('');
    setShowInput(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme selection">
        {allThemes.map(theme => (
          <div
            key={theme}
            className={`py-1.5 px-3 rounded-full text-xs cursor-pointer transition-all duration-200 select-none border min-h-[32px] flex items-center focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078] ${
              selectedThemes.includes(theme)
                ? 'bg-game-primary dark:bg-[#f0d078] text-white dark:text-[#0f1419] border-game-primary dark:border-[#f0d078] font-semibold'
                : 'bg-neutral-100 dark:bg-[#243044] text-neutral-600 dark:text-white/70 border-neutral-200 dark:border-white/[0.08] hover:bg-neutral-200 dark:hover:bg-[#2d3a4f] hover:border-neutral-300 dark:hover:border-white/[0.12]'
            }`}
            onClick={() => handleToggle(theme)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle(theme);
              }
            }}
            aria-pressed={selectedThemes.includes(theme)}
            aria-label={`${theme} theme${selectedThemes.includes(theme) ? ' (selected)' : ''}`}
          >
            {theme}
          </div>
        ))}
        {onAddCustomTheme && !showInput && (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="py-1.5 px-3 rounded-full text-xs border border-dashed border-neutral-300 dark:border-white/20 text-neutral-500 dark:text-white/50 hover:border-game-primary dark:hover:border-[#f0d078] hover:text-game-primary dark:hover:text-[#f0d078] transition-colors min-h-[32px] flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
        )}
      </div>
      {showInput && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTheme();
              } else if (e.key === 'Escape') {
                setShowInput(false);
                setNewTheme('');
              }
            }}
            placeholder="New theme name..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-neutral-50 dark:bg-[#243044] text-sm focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078]"
            autoFocus
            maxLength={20}
          />
          <button
            type="button"
            onClick={handleAddTheme}
            disabled={!newTheme.trim()}
            className="px-3 py-1.5 bg-game-primary dark:bg-[#f0d078] text-white dark:text-[#0f1419] rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowInput(false); setNewTheme(''); }}
            className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-white/70"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
