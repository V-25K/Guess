/**
 * useNavigation Hook
 * Custom hook to manage navigation state and view transitions
 * 
 * Features:
 * - Navigation between different views (gameplay, profile, leaderboard, create)
 * - Navigation history tracking
 * - Back navigation support
 * - Current view state management
 */

import { useState } from '@devvit/public-api';

export type ViewType = 'menu' | 'gameplay' | 'profile' | 'leaderboard' | 'create' | 'loading' | 'awards';

export interface NavigationState {
  currentView: ViewType;
  previousView: ViewType | null;
  history: ViewType[];
}

export interface UseNavigationResult {
  currentView: ViewType;
  previousView: ViewType | null;
  navigateTo: (view: ViewType) => void;
  goBack: () => void;
  canGoBack: boolean;
  history: ViewType[];
}

/**
 * Hook to manage navigation state and transitions
 * 
 * @param initialView - Initial view to display (default: 'menu')
 * @returns Navigation state and control functions
 * 
 * @example
 * const { currentView, navigateTo, goBack, canGoBack } = useNavigation('menu');
 * 
 * // Navigate to a view
 * navigateTo('gameplay');
 * 
 * // Go back to previous view
 * if (canGoBack) {
 *   goBack();
 * }
 * 
 * // Render based on current view
 * if (currentView === 'gameplay') {
 *   return <GameplayView />;
 * }
 */
export function useNavigation(initialView: ViewType = 'menu'): UseNavigationResult {
  // State for current view
  const [currentView, setCurrentView] = useState<ViewType>(initialView);

  // State for previous view
  const [previousView, setPreviousView] = useState<ViewType | null>(null);

  // State for navigation history
  const [history, setHistory] = useState<ViewType[]>([initialView]);

  /**
   * Navigate to a new view
   * Adds the new view to history and updates current/previous views
   */
  const navigateTo = (view: ViewType): void => {

    // Don't navigate if already on the same view
    if (view === currentView) {
      return;
    }

    // Update previous view
    setPreviousView(currentView);

    // Update current view
    setCurrentView(view);

    // Add to history
    setHistory(prev => [...prev, view]);
  };

  /**
   * Go back to the previous view in history
   * Removes the current view from history
   */
  const goBack = (): void => {
    if (history.length <= 1) {
      // Can't go back if we're at the first view
      return;
    }

    // Remove current view from history
    const newHistory = [...history];
    newHistory.pop();
    setHistory(newHistory);

    // Get the previous view
    const previousViewFromHistory = newHistory[newHistory.length - 1];

    // Update views
    setPreviousView(currentView);
    setCurrentView(previousViewFromHistory);
  };

  /**
   * Check if we can go back
   */
  const canGoBack = history.length > 1;

  return {
    currentView,
    previousView,
    navigateTo,
    goBack,
    canGoBack,
    history,
  };
}

/**
 * Hook to manage navigation with view-specific data
 * Useful when you need to pass data between views
 * Note: Data must be JSON-serializable for Devvit state management
 * 
 * @example
 * const { currentView, viewData, navigateToWithData } = useNavigationWithData();
 * 
 * // Navigate with data
 * navigateToWithData('gameplay', { challengeId: '123' });
 * 
 * // Access data in the view
 * if (currentView === 'gameplay' && viewData) {
 *   const challengeId = viewData.challengeId;
 * }
 */
export function useNavigationWithData(
  initialView: ViewType = 'menu'
): UseNavigationResult & {
  viewData: Record<string, any> | null;
  navigateToWithData: (view: ViewType, data: Record<string, any>) => void;
} {
  const navigation = useNavigation(initialView);
  const [viewData, setViewData] = useState<Record<string, any> | null>(null);

  const navigateToWithData = (view: ViewType, data: Record<string, any>): void => {
    setViewData(data);
    navigation.navigateTo(view);
  };

  return {
    ...navigation,
    viewData,
    navigateToWithData,
  };
}
