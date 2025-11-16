/**
 * Theme Constants
 * Centralized design tokens for consistent styling across the application
 */

/**
 * Color Palette
 * Mystery Gradient Grid Theme
 */
export const COLORS = {
  primary: '#6C63FF',
  primaryLight: '#8B84FF',
  primaryDark: '#5449E6',
  
  secondary: '#FF4500',
  secondaryLight: '#FF6A33',
  secondaryDark: '#CC3700',
  
  white: '#FAFAFA',
  black: '#1E1E1E',
  gray900: '#1E1E1E',
  gray800: '#2A2A2A',
  gray700: '#3A3A3A',
  gray600: '#666666',
  gray500: '#878A8C',
  gray400: '#A8AAAB',
  gray300: '#CCCCCC',
  gray200: '#E0E0E0',
  gray100: '#EDEFF1',
  gray50: '#F5F5F5',
  
  success: '#4CAF50',
  successLight: '#E8F5E9',
  successDark: '#388E3C',
  
  error: '#F44336',
  errorLight: '#FFEBEE',
  errorDark: '#C62828',
  
  warning: '#F57C00',
  warningLight: '#FFF3E0',
  warningDark: '#E65100',
  
  info: '#6C63FF',
  infoLight: '#E8E7FF',
  infoDark: '#5449E6',
  
  background: '#FAFAFA',
  backgroundAlt: '#F0F0F0',
  backgroundDark: '#1E1E1E',
  backgroundAccent: '#6C63FF15',
  
  border: '#E0E0E0',
  borderLight: '#EDEFF1',
  borderDark: '#3A3A3A',
  borderAccent: '#6C63FF40',
  
  tagBackground: '#E8E7FF',
  tagText: '#5449E6',
  
  textPrimary: '#1E1E1E',
  textSecondary: '#666666',
  textLight: '#EAEAEA',
  textAccent: '#6C63FF',
} as const;

/**
 * Spacing Scale
 * Based on 4px base unit
 */
export const SPACING = {
  none: 'none',
  xsmall: 'xsmall',
  small: 'small',
  medium: 'medium',
  large: 'large',
  xlarge: 'xlarge',
} as const;

/**
 * Border Radius
 */
export const RADIUS = {
  none: 'none',
  small: 'small',
  medium: 'medium',
  large: 'large',
  full: 'full',
} as const;

/**
 * Typography
 */
export const TYPOGRAPHY = {
  size: {
    xsmall: 'xsmall',
    small: 'small',
    medium: 'medium',
    large: 'large',
    xlarge: 'xlarge',
    xxlarge: 'xxlarge',
  },
  weight: {
    regular: 'regular',
    bold: 'bold',
  },
} as const;

/**
 * Component-specific styles
 */
export const COMPONENT_STYLES = {
  card: {
    padding: SPACING.medium,
    gap: SPACING.medium,
    radius: RADIUS.medium,
    border: COLORS.border,
    background: COLORS.white,
  },
  
  button: {
    height: {
      small: '32px',
      medium: '40px',
      large: '48px',
    },
    width: {
      small: '80px',
      medium: '120px',
      large: '200px',
    },
  },
  
  badge: {
    padding: SPACING.small,
    radius: RADIUS.small,
    gap: SPACING.small,
  },
  
  navigation: {
    background: COLORS.white,
    border: COLORS.borderLight,
    padding: SPACING.small,
    gap: SPACING.small,
  },
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

/**
 * Z-index layers
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  toast: 1400,
} as const;
