/**
 * UI Consistency Validator Component
 * Validates and enforces UI consistency across all components
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import React from 'react';
import { BUTTON_STYLES, POPUP_STYLES, NAVIGATION_STYLES, INPUT_STYLES, ACCESSIBILITY } from '../../utils/ui-consistency';

/**
 * Interface for UI consistency validation results
 */
export interface UIConsistencyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validates button consistency
 */
export function validateButtonConsistency(element: HTMLButtonElement): UIConsistencyValidationResult {
  const result: UIConsistencyValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  const computedStyle = window.getComputedStyle(element);
  const classList = Array.from(element.classList);

  // Check for minimum touch target size
  const width = parseFloat(computedStyle.width);
  const height = parseFloat(computedStyle.height);
  
  if (width < 44 || height < 44) {
    result.errors.push('Button does not meet minimum touch target size (44x44px)');
    result.isValid = false;
  }

  // Check for focus styles
  if (!classList.some(cls => cls.includes('focus:'))) {
    result.warnings.push('Button may be missing focus styles for accessibility');
  }

  // Check for disabled styles
  if (!classList.some(cls => cls.includes('disabled:'))) {
    result.warnings.push('Button may be missing disabled state styles');
  }

  // Check for consistent border radius
  const borderRadius = computedStyle.borderRadius;
  if (!borderRadius.includes('9999px') && !borderRadius.includes('50%')) {
    result.suggestions.push('Consider using rounded-full for consistent button styling');
  }

  return result;
}

/**
 * Validates popup/modal consistency
 */
export function validatePopupConsistency(element: HTMLElement): UIConsistencyValidationResult {
  const result: UIConsistencyValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  const computedStyle = window.getComputedStyle(element);
  const classList = Array.from(element.classList);

  // Check for proper z-index
  const zIndex = parseInt(computedStyle.zIndex);
  if (zIndex < 1000) {
    result.warnings.push('Popup z-index may be too low, consider using z-[9999] or higher');
  }

  // Check for backdrop
  const parent = element.parentElement;
  if (parent && !parent.classList.contains('fixed')) {
    result.errors.push('Popup should have a fixed positioned backdrop overlay');
    result.isValid = false;
  }

  // Check for proper ARIA attributes
  if (!element.getAttribute('role') || !element.getAttribute('aria-modal')) {
    result.errors.push('Popup missing required ARIA attributes (role="dialog", aria-modal="true")');
    result.isValid = false;
  }

  return result;
}

/**
 * Validates navigation consistency
 */
export function validateNavigationConsistency(element: HTMLElement): UIConsistencyValidationResult {
  const result: UIConsistencyValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  const computedStyle = window.getComputedStyle(element);

  // Check for proper navigation role
  if (!element.getAttribute('role') || element.getAttribute('role') !== 'navigation') {
    result.errors.push('Navigation element missing role="navigation"');
    result.isValid = false;
  }

  // Check for aria-label
  if (!element.getAttribute('aria-label')) {
    result.warnings.push('Navigation element should have aria-label for accessibility');
  }

  // Check for consistent positioning
  const position = computedStyle.position;
  if (position !== 'fixed') {
    result.suggestions.push('Consider using fixed positioning for consistent navigation placement');
  }

  return result;
}

/**
 * Validates accessibility compliance
 */
export function validateAccessibilityCompliance(element: HTMLElement): UIConsistencyValidationResult {
  const result: UIConsistencyValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  // Check for keyboard navigation support
  const tabIndex = element.getAttribute('tabindex');
  const isInteractive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
  
  if (isInteractive && tabIndex === '-1') {
    result.warnings.push('Interactive element may not be keyboard accessible (tabindex="-1")');
  }

  // Check for ARIA labels on interactive elements
  if (isInteractive && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
    const textContent = element.textContent?.trim();
    if (!textContent) {
      result.errors.push('Interactive element missing accessible name (aria-label or text content)');
      result.isValid = false;
    }
  }

  // Check for color contrast (basic check)
  const computedStyle = window.getComputedStyle(element);
  const color = computedStyle.color;
  const backgroundColor = computedStyle.backgroundColor;
  
  if (color === backgroundColor) {
    result.errors.push('Element may have insufficient color contrast');
    result.isValid = false;
  }

  return result;
}

/**
 * Comprehensive UI consistency validator
 */
export function validateUIConsistency(element: HTMLElement): UIConsistencyValidationResult {
  const combinedResult: UIConsistencyValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  let validationResults: UIConsistencyValidationResult[] = [];

  // Run appropriate validations based on element type
  if (element.tagName === 'BUTTON') {
    validationResults.push(validateButtonConsistency(element as HTMLButtonElement));
  }

  if (element.getAttribute('role') === 'dialog' || element.classList.contains('modal')) {
    validationResults.push(validatePopupConsistency(element));
  }

  if (element.getAttribute('role') === 'navigation' || element.tagName === 'NAV') {
    validationResults.push(validateNavigationConsistency(element));
  }

  // Always run accessibility validation
  validationResults.push(validateAccessibilityCompliance(element));

  // Combine all results
  validationResults.forEach(result => {
    combinedResult.errors.push(...result.errors);
    combinedResult.warnings.push(...result.warnings);
    combinedResult.suggestions.push(...result.suggestions);
    
    if (!result.isValid) {
      combinedResult.isValid = false;
    }
  });

  return combinedResult;
}

/**
 * UI Consistency Report Component
 * Displays validation results for debugging
 */
export interface UIConsistencyReportProps {
  validationResult: UIConsistencyValidationResult;
  elementName?: string;
}

export const UIConsistencyReport: React.FC<UIConsistencyReportProps> = ({
  validationResult,
  elementName = 'Element'
}) => {
  if (validationResult.errors.length === 0 && validationResult.warnings.length === 0 && validationResult.suggestions.length === 0) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
          ✅ {elementName} - UI Consistency Validated
        </h3>
        <p className="text-xs text-green-600 dark:text-green-300">
          All consistency checks passed successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {validationResult.isValid ? '⚠️' : '❌'} {elementName} - UI Consistency Report
      </h3>

      {validationResult.errors.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-red-600 dark:text-red-400">Errors:</h4>
          <ul className="text-xs text-red-600 dark:text-red-400 space-y-1">
            {validationResult.errors.map((error, index) => (
              <li key={index} className="flex items-start gap-1">
                <span>•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {validationResult.warnings.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">Warnings:</h4>
          <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
            {validationResult.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-1">
                <span>•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {validationResult.suggestions.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400">Suggestions:</h4>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            {validationResult.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-1">
                <span>•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Hook for validating UI consistency in development
 */
export function useUIConsistencyValidation(elementRef: React.RefObject<HTMLElement>, enabled = process.env.NODE_ENV === 'development') {
  const [validationResult, setValidationResult] = React.useState<UIConsistencyValidationResult | null>(null);

  React.useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;
    const result = validateUIConsistency(element);
    setValidationResult(result);

    // Log results in development
    if (result.errors.length > 0) {
      console.error('UI Consistency Errors:', result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn('UI Consistency Warnings:', result.warnings);
    }
    if (result.suggestions.length > 0) {
      console.info('UI Consistency Suggestions:', result.suggestions);
    }
  }, [enabled, elementRef]);

  return validationResult;
}