/**
 * Accessibility Utilities Tests
 * Property-based and unit tests for accessibility utilities
 * Requirements: 9.1, 9.2, 9.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { trapFocus, announceToScreenReader, getFocusableElements } from './accessibility';

describe('Accessibility Utilities', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllTimers();
  });

  describe('trapFocus', () => {
    it('should return cleanup function for empty container', () => {
      const cleanup = trapFocus(container);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('should focus first focusable element', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="second">Second</button>
      `;
      const firstButton = container.querySelector('#first') as HTMLButtonElement;
      
      trapFocus(container);
      
      expect(document.activeElement).toBe(firstButton);
    });

    it('should trap focus within container on Tab', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      const firstButton = container.querySelector('#first') as HTMLButtonElement;
      const lastButton = container.querySelector('#last') as HTMLButtonElement;
      
      trapFocus(container);
      lastButton.focus();
      
      // Simulate Tab on last element
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      Object.defineProperty(tabEvent, 'preventDefault', { value: vi.fn() });
      container.dispatchEvent(tabEvent);
      
      expect(tabEvent.preventDefault).toHaveBeenCalled();
    });

    it('should trap focus within container on Shift+Tab', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      const firstButton = container.querySelector('#first') as HTMLButtonElement;
      
      trapFocus(container);
      firstButton.focus();
      
      // Simulate Shift+Tab on first element
      const shiftTabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab', 
        shiftKey: true, 
        bubbles: true 
      });
      Object.defineProperty(shiftTabEvent, 'preventDefault', { value: vi.fn() });
      container.dispatchEvent(shiftTabEvent);
      
      expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
    });

    it('should remove event listener on cleanup', () => {
      container.innerHTML = '<button>Test</button>';
      const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener');
      
      const cleanup = trapFocus(container);
      cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should ignore non-Tab keys', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      
      trapFocus(container);
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(enterEvent, 'preventDefault', { value: vi.fn() });
      container.dispatchEvent(enterEvent);
      
      expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('announceToScreenReader', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create announcement element with correct attributes', () => {
      announceToScreenReader('Test message');
      
      const announcement = document.querySelector('[role="status"]');
      expect(announcement).not.toBeNull();
      expect(announcement?.getAttribute('aria-live')).toBe('polite');
      expect(announcement?.getAttribute('aria-atomic')).toBe('true');
      expect(announcement?.className).toBe('sr-only');
      expect(announcement?.textContent).toBe('Test message');
    });

    it('should use assertive priority when specified', () => {
      // Clear any existing announcements
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
      
      announceToScreenReader('Urgent message', 'assertive');
      
      const announcement = document.querySelector('[role="status"]');
      expect(announcement?.getAttribute('aria-live')).toBe('assertive');
    });

    it('should remove announcement after timeout', () => {
      // Clear any existing announcements
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
      
      announceToScreenReader('Test message');
      
      const announcement = document.querySelector('[role="status"]');
      expect(announcement).not.toBeNull();
      
      vi.advanceTimersByTime(1001);
      
      // The element should be removed after timeout
      expect(document.body.contains(announcement)).toBe(false);
    });

    it('should handle multiple announcements', () => {
      // Clear any existing announcements first
      document.querySelectorAll('[role="status"]').forEach(el => el.remove());
      
      announceToScreenReader('First message');
      announceToScreenReader('Second message');
      
      const announcements = document.querySelectorAll('[role="status"]');
      expect(announcements.length).toBe(2);
    });
  });

  describe('getFocusableElements', () => {
    it('should return empty array for container with no focusable elements', () => {
      container.innerHTML = '<div>Not focusable</div>';
      
      const elements = getFocusableElements(container);
      
      expect(elements).toEqual([]);
    });

    it('should find buttons', () => {
      container.innerHTML = '<button>Click me</button>';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
      expect(elements[0].tagName).toBe('BUTTON');
    });

    it('should exclude disabled buttons', () => {
      container.innerHTML = `
        <button>Enabled</button>
        <button disabled>Disabled</button>
      `;
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
    });

    it('should find links with href', () => {
      container.innerHTML = '<a href="/test">Link</a>';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
      expect(elements[0].tagName).toBe('A');
    });

    it('should find inputs', () => {
      container.innerHTML = '<input type="text" />';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
      expect(elements[0].tagName).toBe('INPUT');
    });

    it('should exclude disabled inputs', () => {
      container.innerHTML = `
        <input type="text" />
        <input type="text" disabled />
      `;
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
    });

    it('should find selects', () => {
      container.innerHTML = '<select><option>Option</option></select>';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
      expect(elements[0].tagName).toBe('SELECT');
    });

    it('should find textareas', () => {
      container.innerHTML = '<textarea></textarea>';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
      expect(elements[0].tagName).toBe('TEXTAREA');
    });

    it('should find elements with positive tabindex', () => {
      container.innerHTML = '<div tabindex="0">Focusable div</div>';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(1);
    });

    it('should exclude elements with tabindex=-1', () => {
      container.innerHTML = '<div tabindex="-1">Not focusable</div>';
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(0);
    });

    it('should find all focusable element types', () => {
      container.innerHTML = `
        <button>Button</button>
        <a href="/link">Link</a>
        <input type="text" />
        <select><option>Option</option></select>
        <textarea></textarea>
        <div tabindex="0">Div</div>
      `;
      
      const elements = getFocusableElements(container);
      
      expect(elements.length).toBe(6);
    });
  });

  describe('Keyboard Navigation Coverage (Property Tests)', () => {
    // Test data for various interactive element configurations
    const interactiveConfigs = [
      { buttons: 1, inputs: 0, links: 0 },
      { buttons: 2, inputs: 1, links: 0 },
      { buttons: 0, inputs: 2, links: 1 },
      { buttons: 3, inputs: 2, links: 2 },
      { buttons: 5, inputs: 3, links: 3 },
    ];

    it.each(interactiveConfigs)(
      'should find all focusable elements with config: %o',
      (config) => {
        let html = '';
        for (let i = 0; i < config.buttons; i++) {
          html += `<button id="btn-${i}">Button ${i}</button>`;
        }
        for (let i = 0; i < config.inputs; i++) {
          html += `<input id="input-${i}" type="text" />`;
        }
        for (let i = 0; i < config.links; i++) {
          html += `<a id="link-${i}" href="/test">Link ${i}</a>`;
        }
        container.innerHTML = html;

        const elements = getFocusableElements(container);
        const expectedCount = config.buttons + config.inputs + config.links;

        expect(elements.length).toBe(expectedCount);
      }
    );

    it.each(interactiveConfigs)(
      'should trap focus correctly with config: %o',
      (config) => {
        if (config.buttons + config.inputs + config.links === 0) return;

        let html = '';
        for (let i = 0; i < config.buttons; i++) {
          html += `<button id="btn-${i}">Button ${i}</button>`;
        }
        for (let i = 0; i < config.inputs; i++) {
          html += `<input id="input-${i}" type="text" />`;
        }
        for (let i = 0; i < config.links; i++) {
          html += `<a id="link-${i}" href="/test">Link ${i}</a>`;
        }
        container.innerHTML = html;

        const cleanup = trapFocus(container);
        const elements = getFocusableElements(container);

        // First element should be focused
        expect(document.activeElement).toBe(elements[0]);

        cleanup();
      }
    );
  });

  describe('ARIA Label Coverage', () => {
    it('should have role attribute on announcement elements', () => {
      vi.useFakeTimers();
      announceToScreenReader('Test');
      
      const announcement = document.querySelector('[role="status"]');
      expect(announcement).not.toBeNull();
      
      vi.advanceTimersByTime(1000);
      vi.useRealTimers();
    });

    it('should have aria-live attribute on announcement elements', () => {
      vi.useFakeTimers();
      announceToScreenReader('Test');
      
      const announcement = document.querySelector('[aria-live]');
      expect(announcement).not.toBeNull();
      
      vi.advanceTimersByTime(1000);
      vi.useRealTimers();
    });

    it('should have aria-atomic attribute on announcement elements', () => {
      vi.useFakeTimers();
      announceToScreenReader('Test');
      
      const announcement = document.querySelector('[aria-atomic="true"]');
      expect(announcement).not.toBeNull();
      
      vi.advanceTimersByTime(1000);
      vi.useRealTimers();
    });
  });

  describe('Focus Indicator Visibility', () => {
    // Test that focusable elements can receive focus
    const focusableElements = [
      { tag: 'button', html: '<button>Test</button>' },
      { tag: 'input', html: '<input type="text" />' },
      { tag: 'select', html: '<select><option>Test</option></select>' },
      { tag: 'textarea', html: '<textarea></textarea>' },
      { tag: 'a', html: '<a href="/test">Link</a>' },
      { tag: 'div[tabindex]', html: '<div tabindex="0">Focusable</div>' },
    ];

    it.each(focusableElements)(
      'should allow focus on $tag element',
      ({ html }) => {
        container.innerHTML = html;
        const element = container.firstElementChild as HTMLElement;
        
        element.focus();
        
        expect(document.activeElement).toBe(element);
      }
    );

    it.each(focusableElements)(
      'should be found by getFocusableElements for $tag',
      ({ html }) => {
        container.innerHTML = html;
        
        const elements = getFocusableElements(container);
        
        expect(elements.length).toBe(1);
      }
    );
  });
});
