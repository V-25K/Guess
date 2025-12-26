import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS Configuration
 * Custom theme with game-oriented design tokens
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
const config: Config = {
  content: [
    './src/client/**/*.{ts,tsx,html}',
  ],
  // Use 'media' for automatic system preference detection
  // Devvit webviews inherit the Reddit app's color scheme preference
  darkMode: 'media',
  theme: {
    extend: {
      // Color Palette (Requirements: 2.1)
      colors: {
        game: {
          primary: '#FF4500',
          'primary-hover': '#E03D00',
          'primary-light': '#FFE6D9',
          accent: '#FFD700',
          'accent-hover': '#E6C200',
          background: '#FFF8F0',
          card: '#FFFFFF',
          // Dark mode colors
          'background-dark': '#1a2332',
          'surface-dark': '#243044',
          'elevated-dark': '#2a3a52',
          'card-dark': '#243044',
          // Dark mode accent colors
          'blue-start': '#3b5998',
          'blue-end': '#5a7fc2',
          'gold-start': '#d4a84b',
          'gold-mid': '#f0d078',
          'gold-end': '#d4a84b',
        },
        success: {
          light: '#E8F5E9',
          DEFAULT: '#22C55E',
          dark: '#16A34A',
          text: '#166534',
        },
        error: {
          light: '#FFEBEE',
          DEFAULT: '#EF4444',
          dark: '#DC2626',
          text: '#B91C1C',
        },
        warning: {
          light: '#FFF3E0',
          DEFAULT: '#F59E0B',
          dark: '#D97706',
          text: '#B45309',
        },
        info: {
          light: '#E3F2FD',
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
          text: '#1D4ED8',
        },
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },

      // Spacing Scale - 4px base unit (Requirements: 2.2)
      spacing: {
        '0': '0px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },

      // Border Radius (Requirements: 2.4)
      borderRadius: {
        'none': '0',
        'game-sm': '8px',
        'game-md': '16px',
        'game-lg': '24px',
        'game-full': '999px',
      },

      // Box Shadows (Requirements: 2.5)
      boxShadow: {
        'game-card': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'game-float': '0 8px 24px rgba(255, 69, 0, 0.15)',
        'game-glow': '0 0 20px rgba(255, 69, 0, 0.3)',
        'game-inset': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
      },

      // Typography (Requirements: 2.3)
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },

      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      // Touch Target Minimum Size (Requirements: 5.1)
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },

      // Animation (Requirements: 8.5 - reduced motion support)
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-soft': 'bounce 1s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },

      // Transitions
      transitionDuration: {
        'fast': '100ms',
        'normal': '200ms',
        'slow': '300ms',
      },
    },
  },
  plugins: [],
};

export default config;
