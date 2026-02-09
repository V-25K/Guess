/**
 * CreatorTips Component
 * Collapsible tips and guidelines for challenge creators
 */

import React, { useState } from 'react';

export const CreatorTips: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Creator Tips & Guidelines
          </span>
        </div>
        <svg 
          className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 text-xs text-amber-800 dark:text-amber-200 space-y-3">
          <div>
            <p className="font-medium mb-1">✅ Best Practices:</p>
            <ul className="space-y-0.5 text-amber-700 dark:text-amber-300 ml-2">
              <li>• Use clear, high-quality images (square format works best)</li>
              <li>• Make connections logical but not too obvious</li>
              <li>• Write helpful descriptions (they become hints!)</li>
              <li>• Test your challenge - would others see the connection?</li>
              <li>• Keep content appropriate and family-friendly</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium mb-1">❌ Avoid:</p>
            <ul className="space-y-0.5 text-amber-700 dark:text-amber-300 ml-2">
              <li>• Blurry or low-quality images</li>
              <li>• Connections requiring specialized knowledge</li>
              <li>• Text-heavy images where answer is just reading</li>
              <li>• Inappropriate or offensive content</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium mb-1">💡 Pro Tips:</p>
            <ul className="space-y-0.5 text-amber-700 dark:text-amber-300 ml-2">
              <li>• Think about what makes a good puzzle</li>
              <li>• Consider different skill levels in your community</li>
              <li>• Use themes that are broadly relatable</li>
              <li>• Be creative but fair!</li>
            </ul>
          </div>
          
          <div className="pt-2 border-t border-amber-200 dark:border-amber-800/30">
            <p className="text-amber-700 dark:text-amber-300 text-xs font-medium">
              🎯 Remember: The goal is to create engaging, solvable challenges that bring joy to the community!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};