/**
 * Shared Components Barrel Export
 * Requirements: 4.7 - All components importable via barrel exports
 */

// Basic UI Components
export { LoadingView } from './LoadingView';
export { ErrorView } from './ErrorView';

// Button Component
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// Avatar Component
export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize } from './Avatar';

// Input Component
export { Input } from './Input';
export type { InputProps } from './Input';

// Card Component
export { Card } from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';

// Badge Component
export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

// Modal Component
export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';

// Toast Component
export { Toast, DEFAULT_TOAST_DURATION } from './Toast';
export type { ToastProps, ToastType } from './Toast';

// Error Handling
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';
