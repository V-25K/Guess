/**
 * useViewMode Hook
 * Custom hook to detect and manage Devvit web view mode (inline vs expanded)
 *
 * Features:
 * - Detects current view mode (inline or expanded)
 * - Listens for mode changes
 * - Provides helper booleans for conditional rendering
 * - Exposes requestExpanded function for mode transitions
 *
 * Requirements: 1.1, 1.2, 1.3
 */

import { useState, useEffect } from 'react';
import {
  getWebViewMode,
  addWebViewModeListener,
  removeWebViewModeListener,
  requestExpandedMode,
} from '@devvit/web/client';

export type ViewMode = 'inline' | 'expanded';

export interface UseViewModeReturn {
  /** Current view mode ('inline' or 'expanded') */
  mode: ViewMode;
  /** True when in inline mode */
  isInline: boolean;
  /** True when in expanded mode */
  isExpanded: boolean;
  /** Request transition to expanded mode (must be called from trusted event) */
  requestExpanded: (event: PointerEvent, entry?: string) => Promise<void>;
}

/**
 * Hook to detect and manage Devvit web view mode
 *
 * @returns View mode state and control functions
 *
 * @example
 * const { mode, isInline, isExpanded, requestExpanded } = useViewMode();
 *
 * // Conditional rendering based on mode
 * if (isInline) {
 *   return <CompactView />;
 * }
 *
 * // Request expanded mode on user interaction
 * <button onClick={(e) => requestExpanded(e.nativeEvent, 'game')}>
 *   Expand
 * </button>
 */
export function useViewMode(): UseViewModeReturn {
  // Initialize with current mode, defaulting to 'inline' if detection fails
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      return getWebViewMode() ?? 'inline';
    } catch {
      return 'inline';
    }
  });

  useEffect(() => {
    const handleModeChange = (newMode: ViewMode) => {
      setMode(newMode);
    };

    addWebViewModeListener(handleModeChange);

    return () => {
      removeWebViewModeListener(handleModeChange);
    };
  }, []);

  const requestExpanded = async (
    event: PointerEvent,
    entry: string = 'default'
  ): Promise<void> => {
    try {
      await requestExpandedMode(event, entry);
    } catch (error) {
      console.error('Failed to request expanded mode:', error);
    }
  };

  return {
    mode,
    isInline: mode === 'inline',
    isExpanded: mode === 'expanded',
    requestExpanded,
  };
}
