/**
 * DOM Depth Property Test
 * Property-based test to verify component DOM depth doesn't exceed 15 levels
 * 
 * **Feature: frontend-game-redesign, Property 6: DOM Depth Limit**
 * **Validates: Requirements 6.2**
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
import { Avatar } from './shared/Avatar';
import { LoadingView } from './shared/LoadingView';
import { ErrorView } from './shared/ErrorView';

const MAX_DOM_DEPTH = 15;

/**
 * Calculate the maximum depth of a DOM tree
 */
function getMaxDOMDepth(element: Element): number {
  if (!element.children || element.children.length === 0) {
    return 1;
  }
  
  let maxChildDepth = 0;
  for (let i = 0; i < element.children.length; i++) {
    const childDepth = getMaxDOMDepth(element.children[i]);
    maxChildDepth = Math.max(maxChildDepth, childDepth);
  }
  
  return 1 + maxChildDepth;
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
    name: 'Button (ghost)',
    render: () => <Button variant="ghost">Test Button</Button>,
  },
  {
    name: 'Button (danger)',
    render: () => <Button variant="danger">Test Button</Button>,
  },
  {
    name: 'Card (default)',
    render: () => <Card>Card Content</Card>,
  },
  {
    name: 'Card (elevated)',
    render: () => <Card variant="elevated">Card Content</Card>,
  },
  {
    name: 'Card (outlined)',
    render: () => <Card variant="outlined">Card Content</Card>,
  },
  {
    name: 'Badge (default)',
    render: () => <Badge>Badge</Badge>,
  },
  {
    name: 'Input',
    render: () => <Input placeholder="Test input" />,
  },
  {
    name: 'Avatar (with image)',
    render: () => <Avatar src="https://example.com/avatar.png" alt="Test avatar" />,
  },
  {
    name: 'Avatar (fallback)',
    render: () => <Avatar alt="Test avatar" fallbackInitials="T" />,
  },
  {
    name: 'LoadingView',
    render: () => <LoadingView />,
  },
  {
    name: 'ErrorView',
    render: () => <ErrorView message="Test error" />,
  },
];

describe('DOM Depth Property Tests', () => {
  /**
   * **Feature: frontend-game-redesign, Property 6: DOM Depth Limit**
   * **Validates: Requirements 6.2**
   * 
   * For any rendered component tree, the maximum DOM nesting depth 
   * should not exceed 15 levels to ensure rendering performance.
   */
  it(`should have all components with DOM depth under ${MAX_DOM_DEPTH} levels`, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TESTABLE_COMPONENTS),
        (componentConfig) => {
          const { container } = render(componentConfig.render());
          const depth = getMaxDOMDepth(container);
          
          expect(
            depth,
            `Component ${componentConfig.name} has DOM depth of ${depth}, exceeding limit of ${MAX_DOM_DEPTH}`
          ).toBeLessThanOrEqual(MAX_DOM_DEPTH);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Report DOM depths for all components for visibility
   */
  it('should report DOM depths for all components', () => {
    const results = TESTABLE_COMPONENTS.map((componentConfig) => {
      const { container } = render(componentConfig.render());
      const depth = getMaxDOMDepth(container);
      return {
        name: componentConfig.name,
        depth,
        withinLimit: depth <= MAX_DOM_DEPTH,
      };
    });

    // Log summary
    const overLimit = results.filter((r) => !r.withinLimit);
    
    if (overLimit.length > 0) {
      console.log('\nComponents exceeding DOM depth limit:');
      overLimit.forEach((r) => {
        console.log(`  ${r.name}: ${r.depth} levels (over by ${r.depth - MAX_DOM_DEPTH})`);
      });
    }

    // All components should be within limit
    expect(overLimit.length).toBe(0);
  });
});
