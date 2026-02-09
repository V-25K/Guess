/**
 * Modal Component
 * Accessible modal dialog with focus trapping
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { trapFocus } from '../../../utils/accessibility';
import { POPUP_STYLES } from '../../../utils/ui-consistency';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title (displayed in header) */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Size of the modal */
  size?: ModalSize;
  /** Whether clicking the overlay closes the modal */
  closeOnOverlayClick?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-xs',
  md: 'max-w-md',
  lg: 'max-w-xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Set up focus trapping and return focus on close
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const cleanup = trapFocus(modalRef.current);

    return () => {
      cleanup();
      // Return focus to the element that was focused before modal opened
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className={POPUP_STYLES.overlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`${POPUP_STYLES.container} ${sizeStyles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className={POPUP_STYLES.header}>
            <h2 
              id="modal-title" 
              className={POPUP_STYLES.title}
            >
              {title}
            </h2>
            <button
              type="button"
              className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:text-white/50 dark:hover:text-white/70 dark:hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-game-primary dark:focus:ring-[#f0d078]"
              onClick={onClose}
              aria-label="Close modal"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
        <div className={title ? POPUP_STYLES.content : 'p-6'}>
          {children}
        </div>
      </div>
    </div>
  );
}
