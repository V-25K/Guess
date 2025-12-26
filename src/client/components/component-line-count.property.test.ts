/**
 * Component Line Count Property Test
 * Property-based test to verify component files don't exceed 200 lines
 * 
 * **Feature: frontend-game-redesign, Property 1: Component Line Count Limit**
 * **Validates: Requirements 3.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const MAX_COMPONENT_LINES = 200;
const COMPONENTS_DIR = path.resolve(__dirname);

/**
 * Recursively get all .tsx component files (excluding test files)
 */
function getComponentFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...getComponentFiles(fullPath));
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.tsx') &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.property.test.')
      ) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}

/**
 * Count lines in a file
 */
function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Get relative path from components directory
 */
function getRelativePath(filePath: string): string {
  return path.relative(COMPONENTS_DIR, filePath);
}

describe('Component Line Count Property Tests', () => {
  const componentFiles = getComponentFiles(COMPONENTS_DIR);
  
  /**
   * **Feature: frontend-game-redesign, Property 1: Component Line Count Limit**
   * **Validates: Requirements 3.2**
   * 
   * For any React component file in the components directory, 
   * the file should contain no more than 200 lines of code.
   */
  it(`should have all component files under ${MAX_COMPONENT_LINES} lines`, () => {
    // Skip if no component files found (e.g., running in isolation)
    if (componentFiles.length === 0) {
      console.warn('No component files found to test');
      return;
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...componentFiles),
        (filePath) => {
          const lineCount = countLines(filePath);
          const relativePath = getRelativePath(filePath);
          
          // Component file must not exceed MAX_COMPONENT_LINES
          expect(
            lineCount,
            `Component ${relativePath} has ${lineCount} lines, exceeding limit of ${MAX_COMPONENT_LINES}`
          ).toBeLessThanOrEqual(MAX_COMPONENT_LINES);
        }
      ),
      { numRuns: Math.min(100, componentFiles.length) }
    );
  });

  /**
   * Report all component files and their line counts for visibility
   */
  it('should report line counts for all components', () => {
    const results = componentFiles.map((filePath) => ({
      file: getRelativePath(filePath),
      lines: countLines(filePath),
      withinLimit: countLines(filePath) <= MAX_COMPONENT_LINES,
    }));

    // Log summary
    const overLimit = results.filter((r) => !r.withinLimit);
    
    if (overLimit.length > 0) {
      console.log('\nComponents exceeding line limit:');
      overLimit.forEach((r) => {
        console.log(`  ${r.file}: ${r.lines} lines (over by ${r.lines - MAX_COMPONENT_LINES})`);
      });
    }

    // All components should be within limit
    expect(overLimit.length).toBe(0);
  });
});
