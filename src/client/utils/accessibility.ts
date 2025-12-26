/**
 * Accessibility Utilities
 * Focus management and screen reader utilities
 * Requirements: 9.1, 9.2
 */

/** Selector for all focusable elements */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps focus within a container element.
 * Returns a cleanup function to remove the event listener.
 * 
 * @param element - The container element to trap focus within
 * @returns Cleanup function to remove the focus trap
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  
  if (focusableElements.length === 0) {
    return () => {};
  }
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };
  
  element.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();
  
  return () => element.removeEventListener('keydown', handleKeyDown);
}

/**
 * Announces a message to screen readers using an ARIA live region.
 * 
 * @param message - The message to announce
 * @param priority - The urgency of the announcement ('polite' or 'assertive')
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Gets all focusable elements within a container.
 * 
 * @param container - The container element to search within
 * @returns Array of focusable elements
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}
