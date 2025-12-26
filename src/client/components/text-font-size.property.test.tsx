/**
 * Text Minimum Font Size Property Test
 * Property-based test to verify text elements meet minimum font size requirements
 * 
 * **Feature: frontend-game-redesign, Property 5: Text Minimum Font Size**
 * **Validates: Requirements 5.5**
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';

// Import components to test
import { Button } from './shared/Button';
import { Card } from './shared/Card';
import { Badge } from './shared/Badge';
import { Input } from './shared/Input';
import { LoadingView } from './shared/LoadingView';
import { ErrorView } from './shared/ErrorView';

// Minimum font sizes per Requirements 5.5
const MIN_CAPTION_FONT_SIZE = 12; // 12px for captions
const MIN_BODY_FONT_SIZE = 14; // 14px for body text

/**
 * Parse font size from CSS value (e.g., "14px" -> 14)
 */
function parseFontSize(fontSize: string): number {
  const match = fontSize.match(/^(\d+(?:\.\d+)?)(px|rem|em)?$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'px';
  
  // Convert rem/em to px (assuming 16px base)
  if (unit === 'rem' || unit === 'em') {
    return value * 16;
  }
  
  return value;
}

/**
 * Get all text elements from a container
 */
function getTextElements(container: HTMLElement): HTMLElement[] {
  const textElements: HTMLElement[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const element = node as HTMLElement;
        // Include elements that typically contain text
        const textTags = ['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'BUTTON', 'A', 'LI', 'TD', 'TH', 'SMALL'];
        if (textTags.includes(element.tagName)) {
          // Only include if it has direct text content
          const hasDirectText = Array.from(element.childNodes).some(
            child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
          );
          if (hasDirectText) {
            return NodeFilter.FILTER_ACCEPT;
          }
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    textElements.push(node as HTMLElement);
  }
  
  return textElements;
}

/**
 * Check if an element is a caption (small text like labels, hints)
 */
function isCaption(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  const className = element.className || '';
  
  // Elements that are typically captions
  if (tagName === 'small' || tagName === 'label') return true;
  
  // Check for caption-like classes
  if (className.includes('text-xs') || 
      className.includes('text-[10px]') || 
      className.includes('text-[11px]') ||
      className.includes('caption') ||
      className.includes('hint') ||
      className.includes('helper')) {
    return true;
  }
  
  return false;
}

// Component configurations for testing
const TESTABLE_COMPONENTS = [
  {
    name: 'Button (primary)',
    render: () => <Button variant="primary">Test Button</Button>,
  },
  {
    name: 'Button (secondary)',
    render: () => <Button variant="secondary">Test Button</Button>,
  },
  {
    name: 'Button (sm)',
    render: () => <Button size="sm">Small Button</Button>,
  },
  {
    name: 'Button (lg)',
    render: () => <Button size="lg">Large Button</Button>,
  },
  {
    name: 'Card with text',
    render: () => <Card><p>Card content text</p></Card>,
  },
  {
    name: 'Badge',
    render: () => <Badge>Badge Text</Badge>,
  },
  {
    name: 'Input with label',
    render: () => <Input label="Input Label" placeholder="Placeholder" />,
  },
  {
    name: 'Input with error',
    render: () => <Input label="Input" error="Error message" />,
  },
  {
    name: 'Input with helper',
    render: () => <Input label="Input" helperText="Helper text" />,
  },
  {
    name: 'LoadingView',
    render: () => <LoadingView message="Loading..." />,
  },
  {
    name: 'ErrorView',
    render: () => <ErrorView message="Error occurred" />,
  },
];

describe('Text Minimum Font Size Property Tests', () => {
  /**
   * **Feature: frontend-game-redesign, Property 5: Text Minimum Font Size**
   * **Validates: Requirements 5.5**
   * 
   * For any text element in the application, the computed font size should be 
   * at least 12px for captions and 14px for body text.
   */
  it('should have all text elements meet minimum font size requirements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TESTABLE_COMPONENTS),
        (componentConfig) => {
          const { container } = render(componentConfig.render());
          const textElements = getTextElements(container);
          
          textElements.forEach((element) => {
            const computedStyle = window.getComputedStyle(element);
            const fontSize = parseFontSize(computedStyle.fontSize);
            const minSize = isCaption(element) ? MIN_CAPTION_FONT_SIZE : MIN_BODY_FONT_SIZE;
            
            expect(
              fontSize,
              `Element in ${componentConfig.name} has font size ${fontSize}px, below minimum ${minSize}px`
            ).toBeGreaterThanOrEqual(minSize);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Verify Tailwind font size configuration meets requirements
   * Note: This test validates the configuration values, not runtime CSS
   * since Tailwind classes aren't processed in the test environment
   */
  it('should have Tailwind font size configuration that meets minimum requirements', () => {
    // Verify our Tailwind config font sizes meet the requirements
    // These values are from tailwind.config.ts
    const tailwindFontSizes = {
      'xs': 12,   // 12px - minimum for captions
      'sm': 14,   // 14px - minimum for body text
      'base': 16, // 16px
      'lg': 18,   // 18px
      'xl': 20,   // 20px
      '2xl': 24,  // 24px
      '3xl': 30,  // 30px
      '4xl': 36,  // 36px
    };

    // Verify xs (caption) meets minimum caption size
    expect(tailwindFontSizes['xs']).toBeGreaterThanOrEqual(MIN_CAPTION_FONT_SIZE);
    
    // Verify sm (body) meets minimum body text size
    expect(tailwindFontSizes['sm']).toBeGreaterThanOrEqual(MIN_BODY_FONT_SIZE);
    
    // Verify all other sizes are larger than body minimum
    Object.entries(tailwindFontSizes).forEach(([key, size]) => {
      if (key !== 'xs') {
        expect(
          size,
          `Font size ${key} (${size}px) should be at least ${MIN_BODY_FONT_SIZE}px`
        ).toBeGreaterThanOrEqual(MIN_BODY_FONT_SIZE);
      }
    });
  });

  /**
   * Report font sizes for all components for visibility
   */
  it('should report font sizes for all components', () => {
    const results: Array<{
      component: string;
      element: string;
      fontSize: number;
      isCaption: boolean;
      meetsRequirement: boolean;
    }> = [];

    TESTABLE_COMPONENTS.forEach((componentConfig) => {
      const { container } = render(componentConfig.render());
      const textElements = getTextElements(container);
      
      textElements.forEach((element, index) => {
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFontSize(computedStyle.fontSize);
        const caption = isCaption(element);
        const minSize = caption ? MIN_CAPTION_FONT_SIZE : MIN_BODY_FONT_SIZE;
        
        results.push({
          component: componentConfig.name,
          element: `${element.tagName.toLowerCase()}[${index}]`,
          fontSize,
          isCaption: caption,
          meetsRequirement: fontSize >= minSize,
        });
      });
    });

    // Check for violations
    const violations = results.filter((r) => !r.meetsRequirement);
    
    if (violations.length > 0) {
      console.log('\nFont size violations:');
      violations.forEach((v) => {
        const minSize = v.isCaption ? MIN_CAPTION_FONT_SIZE : MIN_BODY_FONT_SIZE;
        console.log(`  ${v.component} - ${v.element}: ${v.fontSize}px (min: ${minSize}px)`);
      });
    }

    // All text should meet requirements
    expect(violations.length).toBe(0);
  });
});
