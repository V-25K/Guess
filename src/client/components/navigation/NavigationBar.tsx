/**
 * NavigationBar Component
 * Simple navigation bar for switching between views
 */

import { Devvit } from '@devvit/public-api';
import type { ViewType } from '../../hooks/useNavigation.js';

export interface NavigationBarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export const NavigationBar: Devvit.BlockComponent<NavigationBarProps> = (
  { currentView, onNavigate }
) => {
  const isActive = (view: ViewType) => currentView === view;

  return (
    <hstack
      width="100%"
      padding="small"
      gap="small"
      backgroundColor="#FFFFFF"
      borderColor="#E0E0E0"
    >
      <button
        appearance={isActive('menu') ? 'primary' : 'secondary'}
        size="small"
        onPress={() => onNavigate('menu')}
      >
        🏠 Menu
      </button>

      <button
        appearance={isActive('profile') ? 'primary' : 'secondary'}
        size="small"
        onPress={() => onNavigate('profile')}
      >
        👤 Profile
      </button>

      <button
        appearance={isActive('leaderboard') ? 'primary' : 'secondary'}
        size="small"
        onPress={() => onNavigate('leaderboard')}
      >
        🏆 Leaderboard
      </button>

      <button
        appearance={isActive('awards') ? 'primary' : 'secondary'}
        size="small"
        onPress={() => onNavigate('awards')}
      >
        🏅 Awards
      </button>
    </hstack>
  );
};
