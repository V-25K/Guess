/**
 * FeedbackBubble Component
 * Chat-style feedback bubble showing game messages, rewards, and achievements
 */

import React from 'react';
import type { AttemptResult } from '../../../shared/models/attempt.types';
import type { UserProfile } from '../../../shared/models/user.types';
import { BADGES } from '../awards/BadgeItem';

export interface FeedbackBubbleProps {
  message: string;
  creatorAvatarUrl?: string;
  creatorUsername: string;
  isCorrect: boolean;
  isGameOver: boolean;
  /** Whether to use compact sizing for inline mode */
  compact?: boolean;
  /** Reward data from successful completion */
  reward?: AttemptResult['reward'];
  /** User profile before this attempt (to detect newly unlocked badges) */
  previousProfile?: UserProfile | null;
  /** User profile after this attempt */
  currentProfile?: UserProfile | null;
}

/** Get newly unlocked badges by comparing before/after profiles */
function getNewlyUnlockedBadges(
  previousProfile: UserProfile | null | undefined,
  currentProfile: UserProfile | null | undefined
) {
  if (!currentProfile) return [];
  
  return BADGES.filter(badge => {
    const wasUnlocked = previousProfile ? badge.condition(previousProfile) : false;
    const isNowUnlocked = badge.condition(currentProfile);
    return !wasUnlocked && isNowUnlocked;
  });
}

export const FeedbackBubble: React.FC<FeedbackBubbleProps> = ({
  message,
  creatorAvatarUrl,
  creatorUsername,
  isCorrect,
  isGameOver,
  compact = false,
  reward,
  previousProfile,
  currentProfile,
}) => {
  const getBubbleStatusClasses = () => {
    if (isCorrect) return 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20';
    if (isGameOver) return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
    return 'bg-white dark:bg-[#2d3a4f] border-neutral-200 dark:border-white/[0.12]';
  };

  const getMessageTextClasses = () => {
    if (isCorrect) return 'text-green-700 dark:text-green-400';
    if (isGameOver) return 'text-red-700 dark:text-red-400';
    return 'text-neutral-900 dark:text-white/95';
  };

  const avatarSize = compact ? 'w-6 h-6' : 'w-10 h-10';
  const avatarTextSize = compact ? 'text-xs' : 'text-base';

  const newBadges = isCorrect ? getNewlyUnlockedBadges(previousProfile, currentProfile) : [];
  const hasRewards = isCorrect && reward && (reward.totalPoints || reward.bonuses?.length);

  return (
    <div className={`w-full flex items-start flex-shrink-0 ${compact ? 'max-w-[280px] gap-2' : 'max-w-[360px] gap-3'}`}>
      {creatorAvatarUrl ? (
        <img
          src={creatorAvatarUrl}
          className={`flex-shrink-0 ${avatarSize} rounded-full object-cover`}
          alt={`${creatorUsername}'s avatar`}
        />
      ) : (
        <div
          className={`flex-shrink-0 ${avatarSize} rounded-full flex items-center justify-center bg-[#f0d078] text-[#1a2332] font-bold ${avatarTextSize}`}
          role="img"
          aria-label={`${creatorUsername}'s avatar`}
        >
          {creatorUsername.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 flex flex-col gap-0.5">
        <div
          className={`relative rounded-2xl rounded-tl-sm shadow-sm dark:shadow-black/20 border ${getBubbleStatusClasses()} ${compact ? 'py-1.5 px-2.5' : 'py-3 px-4'} overflow-hidden`}
        >
          {/* Main message */}
          <p className={`${getMessageTextClasses()} ${compact ? 'text-xs leading-snug' : 'text-sm leading-relaxed'} ${hasRewards || newBadges.length ? 'mb-2' : ''}`}>
            {message || "Can you guess the link?"}
          </p>

          {/* Rewards Section - Only show on correct answer */}
          {hasRewards && (
            <div className="border-t border-green-200 dark:border-green-500/20 pt-2 mt-2">
              {/* Points earned */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Rewards Earned</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-[#f0d078]">
                    +{reward.totalPoints || reward.points} pts
                  </span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    +{reward.totalExp || reward.experience} xp
                  </span>
                </div>
              </div>

              {/* Bonuses */}
              {reward.bonuses && reward.bonuses.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reward.bonuses.map((bonus, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-500/20 dark:to-yellow-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                    >
                      <BonusIcon type={bonus.type} />
                      <span>{bonus.label}</span>
                      <span className="text-amber-500 dark:text-amber-400">+{bonus.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Newly Unlocked Badges */}
          {newBadges.length > 0 && (
            <div className={`border-t border-green-200 dark:border-green-500/20 pt-2 ${hasRewards ? 'mt-2' : 'mt-2'}`}>
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 block mb-2">
                Badge Unlocked!
              </span>
              <div className="flex flex-wrap gap-2">
                {newBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-500/15 dark:to-indigo-500/15 border border-purple-200 dark:border-purple-500/30"
                  >
                    <img
                      src={badge.icon}
                      alt=""
                      className="w-6 h-6 object-contain"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                        {badge.name}
                      </span>
                      <span className="text-[10px] text-purple-500 dark:text-purple-400">
                        {badge.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Icon component for bonus types */
const BonusIcon: React.FC<{ type: string }> = ({ type }) => {
  const iconClass = "w-3 h-3";
  
  switch (type) {
    case 'first_clear':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
        </svg>
      );
    case 'perfect_solve':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      );
    case 'speed_demon':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
      );
    case 'comeback_king':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
        </svg>
      );
    case 'streak':
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
  }
};
