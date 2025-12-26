/**
 * How to Play Modal Component
 * Displays game instructions with tabbed content:
 * 1. Points System - explains scoring and rewards
 * 2. Example - shows a sample game flow
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'points' | 'example';

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('points');
  const contentRef = useRef<HTMLDivElement>(null);
  const [showUpArrow, setShowUpArrow] = useState(false);
  const [showDownArrow, setShowDownArrow] = useState(true);

  const updateArrows = useCallback(() => {
    const el = contentRef.current;
    if (el) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowUpArrow(scrollTop > 5);
      setShowDownArrow(scrollTop < scrollHeight - clientHeight - 5);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Reset and check after render
      const timer = setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
          updateArrows();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, updateArrows]);

  const scrollUp = () => {
    contentRef.current?.scrollBy({ top: -150, behavior: 'smooth' });
  };

  const scrollDown = () => {
    contentRef.current?.scrollBy({ top: 150, behavior: 'smooth' });
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a2332] border border-neutral-200 dark:border-white/20 rounded-2xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden"
        style={{ height: 'min(500px, 80vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            How to Play
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-white/60"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('points')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors relative ${
              activeTab === 'points'
                ? 'text-game-primary dark:text-[#f0d078]'
                : 'text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            Points System
            {activeTab === 'points' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-game-primary dark:bg-[#f0d078]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('example')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors relative ${
              activeTab === 'example'
                ? 'text-game-primary dark:text-[#f0d078]'
                : 'text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            Example
            {activeTab === 'example' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-game-primary dark:bg-[#f0d078]" />
            )}
          </button>
        </div>

        {/* Content with scroll navigation */}
        <div className="relative flex-1 min-h-0">
          {/* Scrollable Content */}
          <div
            ref={contentRef}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-4 py-4"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onScroll={updateArrows}
          >
            {activeTab === 'points' && <PointsSystemTab />}
            {activeTab === 'example' && <ExampleTab />}
          </div>

          {/* Scroll Up Arrow */}
          {showUpArrow && (
            <button
              onClick={scrollUp}
              className="absolute top-2 right-3 z-30 w-8 h-8 rounded-full bg-white dark:bg-[#243044] shadow-lg border border-neutral-300 dark:border-white/30 flex items-center justify-center text-neutral-700 dark:text-white hover:bg-neutral-100 dark:hover:bg-[#2a3a4f] transition-all"
              aria-label="Scroll up"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* Scroll Down Arrow */}
          {showDownArrow && (
            <button
              onClick={scrollDown}
              className="absolute bottom-2 right-3 z-30 w-8 h-8 rounded-full bg-white dark:bg-[#243044] shadow-lg border border-neutral-300 dark:border-white/30 flex items-center justify-center text-neutral-700 dark:text-white hover:bg-neutral-100 dark:hover:bg-[#2a3a4f] transition-all"
              aria-label="Scroll down"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="p-4 border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-[#1a2332] flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FF4500] to-[#FF6B35] dark:from-[#d4a84b] dark:to-[#f0d078] text-white dark:text-[#1a2332] font-bold hover:from-[#E03D00] hover:to-[#E55A2B] dark:hover:from-[#e4b85b] dark:hover:to-[#fff088] transition-all"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

function PointsSystemTab() {
  return (
    <div className="space-y-4 text-sm">
      {/* Scoring Overview */}
      <div>
        <h3 className="font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="text-lg">🎯</span> Scoring
        </h3>
        <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-neutral-600 dark:text-white/70">
            <span>Max score (1st attempt)</span>
            <span className="font-semibold text-game-primary dark:text-[#f0d078]">30 pts</span>
          </div>
          <div className="flex justify-between text-neutral-600 dark:text-white/70">
            <span>Min score (10th attempt)</span>
            <span className="font-semibold text-game-primary dark:text-[#f0d078]">12 pts</span>
          </div>
          <div className="flex justify-between text-neutral-600 dark:text-white/70">
            <span>Wrong guess penalty</span>
            <span className="font-semibold text-red-500">-2 pts</span>
          </div>
        </div>
      </div>

      {/* Attempts */}
      <div>
        <h3 className="font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="text-lg">🔄</span> Attempts
        </h3>
        <p className="text-neutral-600 dark:text-white/70">
          You get <span className="font-semibold text-game-primary dark:text-[#f0d078]">10 attempts</span> per challenge. 
          Each wrong guess costs <span className="font-semibold text-red-500">2 points</span>. Solve it faster for more points!
        </p>
      </div>

      {/* Hints */}
      <div>
        <h3 className="font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="text-lg">💡</span> Paid Hints
        </h3>
        <p className="text-neutral-600 dark:text-white/70 mb-2">
          Tap the <span className="font-semibold">Hint</span> button, then tap an image to reveal its description. 
          Look for the <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 rounded text-green-600 dark:text-green-400 text-xs font-medium">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            revealed
          </span> badge on images you've unlocked!
        </p>
        <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-2 space-y-1 text-xs">
          <div className="flex justify-between text-neutral-600 dark:text-white/70">
            <span>3-image challenge</span>
            <span className="font-semibold text-amber-500">4 pts per hint</span>
          </div>
          <div className="flex justify-between text-neutral-600 dark:text-white/70">
            <span>2-image challenge</span>
            <span className="font-semibold text-amber-500">6 pts per hint</span>
          </div>
        </div>
      </div>

      {/* Starting Points */}
      <div>
        <h3 className="font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="text-lg">🎁</span> Welcome Bonus
        </h3>
        <p className="text-neutral-600 dark:text-white/70">
          New players start with <span className="font-semibold text-game-primary dark:text-[#f0d078]">30 points</span> to 
          help you get started with hints!
        </p>
      </div>

      {/* Leveling */}
      <div>
        <h3 className="font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="text-lg">⬆️</span> Leveling Up
        </h3>
        <p className="text-neutral-600 dark:text-white/70">
          Earn <span className="font-semibold text-game-primary dark:text-[#f0d078]">XP</span> by solving challenges. 
          Level up to unlock badges and the ability to create challenges at <span className="font-semibold">Level 3</span>.
        </p>
      </div>

      {/* Streaks */}
      <div>
        <h3 className="font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
          <span className="text-lg">🔥</span> Streaks
        </h3>
        <p className="text-neutral-600 dark:text-white/70">
          Solve challenges consecutively to build your streak. 
          Higher streaks unlock special badges!
        </p>
      </div>
    </div>
  );
}

function ExampleTab() {
  return (
    <div className="space-y-4 text-sm">
      {/* Themes - Important hint! */}
      <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-200 dark:border-amber-500/20">
        <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
          <span className="text-lg">🎨</span> Themes = Free Hints!
        </h3>
        <p className="text-amber-700 dark:text-amber-400 text-xs mb-2">
          The <span className="font-semibold">themes</span> below the challenge title are your 
          <span className="font-semibold"> biggest clue</span>! They tell you the category or direction of the answer.
        </p>
        <div className="bg-white dark:bg-[#243044] rounded p-2 border border-amber-200 dark:border-amber-500/20">
          <p className="text-amber-600 dark:text-amber-400 text-xs">
            💡 Example: If themes show <span className="inline-block px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 rounded text-amber-700 dark:text-amber-300 font-semibold">Movies</span> and <span className="inline-block px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 rounded text-amber-700 dark:text-amber-300 font-semibold">90s</span>, 
            the answer is likely a movie from the 1990s!
          </p>
        </div>
      </div>

      {/* Step 1 */}
      <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-game-primary dark:bg-[#f0d078] text-white dark:text-[#1a2332] flex items-center justify-center font-bold text-sm flex-shrink-0">
            1
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">
              View the Images
            </h4>
            <p className="text-neutral-600 dark:text-white/70 text-xs">
              You'll see 2-3 images. Look carefully at each one.
            </p>
            <div className="mt-2 flex gap-2">
              <div className="w-12 h-12 bg-neutral-200 dark:bg-white/10 rounded flex items-center justify-center text-lg">
                🍋
              </div>
              <div className="w-12 h-12 bg-neutral-200 dark:bg-white/10 rounded flex items-center justify-center text-lg">
                🍊
              </div>
              <div className="w-12 h-12 bg-neutral-200 dark:bg-white/10 rounded flex items-center justify-center text-lg">
                🍈
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-neutral-50 dark:bg-white/5 rounded-lg p-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-game-primary dark:bg-[#f0d078] text-white dark:text-[#1a2332] flex items-center justify-center font-bold text-sm flex-shrink-0">
            2
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-1">
              Find the Connection
            </h4>
            <p className="text-neutral-600 dark:text-white/70 text-xs">
              Think about what links all the images together. Be specific!
            </p>
            <div className="mt-2 text-neutral-500 dark:text-white/50 italic text-xs">
              💭 "Lemon, Orange, Grapefruit... they're all fruits!"
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 - Close answer */}
      <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-200 dark:border-amber-500/20">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            ~
          </div>
          <div>
            <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
              Close! Try again...
            </h4>
            <p className="text-amber-600 dark:text-amber-400/80 text-xs">
              You guessed <span className="font-semibold">"Fruits"</span> - that's close but not specific enough! 
              Think about what makes these fruits special...
            </p>
            <div className="mt-2 bg-white dark:bg-[#243044] border border-amber-200 dark:border-amber-500/20 rounded px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
              Hint: What type of fruits are these?
            </div>
          </div>
        </div>
      </div>

      {/* Step 4 - Correct */}
      <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-3 border border-green-200 dark:border-green-500/20">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            ✓
          </div>
          <div>
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-1">
              Correct! +28 Points
            </h4>
            <p className="text-green-600 dark:text-green-400/80 text-xs">
              The answer was <span className="font-semibold">"Citrus Fruits"</span>! 
              Being specific helps you get it right. Great job!
            </p>
          </div>
        </div>
      </div>

      {/* Key Insight */}
      <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 border border-blue-200 dark:border-blue-500/20">
        <div className="flex items-start gap-2">
          <span className="text-lg">💡</span>
          <div>
            <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-1 text-xs">
              Key Insight
            </h4>
            <p className="text-blue-600 dark:text-blue-400/80 text-xs">
              Answers are often more specific than you'd think! "Fruits" was close, 
              but "Citrus Fruits" was the exact connection. Look for the unique link!
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="border-t border-neutral-200 dark:border-white/10 pt-4">
        <h4 className="font-semibold text-neutral-900 dark:text-white mb-2 text-xs uppercase tracking-wide">
          Pro Tips
        </h4>
        <ul className="space-y-1.5 text-neutral-600 dark:text-white/70 text-xs">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Check the <span className="font-semibold text-amber-600 dark:text-amber-400">themes</span> first - they're free hints!</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Tap images to enlarge them for a closer look</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Use paid hints sparingly - they cost points!</span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>Be specific - the connection is usually precise</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
