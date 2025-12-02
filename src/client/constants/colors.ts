/**
 * Color Constants
 * Centralized color definitions for consistent theming across the app
 */

export const COLORS = {
  // Background colors
  background: {
    primary: '#FFF8F0',      // Warm cream - main background (light mode friendly)
    secondary: '#FFFFFF',     // Pure white - cards, modals
    tertiary: '#FFF5E6',      // Slightly warmer - subtle sections
  },
  
  // Text colors
  text: {
    primary: '#1c1c1c',       // Main text
    secondary: '#878a8c',     // Muted text
    accent: '#FF4500',        // Reddit orange
  },
  
  // UI elements
  ui: {
    border: '#E8E0D8',        // Warm border color
    divider: '#F0E8E0',       // Warm divider
    success: '#46D160',       // Green for success states
    error: '#FF4500',         // Red/orange for errors
  },
} as const;

// Shorthand for the most commonly used background
export const BG_PRIMARY = COLORS.background.primary;
export const BG_SECONDARY = COLORS.background.secondary;
