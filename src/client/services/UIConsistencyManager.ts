/**
 * UIConsistencyManager Service
 * Manages UI consistency across all components and provides standardized styling
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 - UI consistency and accessibility standards
 */

import React from 'react';
import { 
  BUTTON_STYLES, 
  POPUP_STYLES, 
  NAVIGATION_STYLES, 
  INPUT_STYLES, 
  ACCESSIBILITY,
  getButtonClasses,
  getNavigationItemClasses,
  getInputClasses
} from '../utils/ui-consistency';

/**
 * UI consistency validation result
 */
export interface UIConsistencyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  score: number; // 0-100 consistency score
}

/**
 * UI component type for validation
 */
export type UIComponentType = 
  | 'button' 
  | 'popup' 
  | 'navigation' 
  | 'input' 
  | 'error-feedback'
  | 'accessibility';

/**
 * UI consistency configuration
 */
export interface UIConsistencyConfig {
  /** Whether to enforce strict consistency rules */
  strictMode: boolean;
  /** Whether to validate accessibility compliance */
  validateAccessibility: boolean;
  /** Whether to log consistency issues to console */
  logIssues: boolean;
  /** Minimum consistency score required (0-100) */
  minimumScore: number;
}

/**
 * Default UI consistency configuration
 */
const DEFAULT_CONFIG: UIConsistencyConfig = {
  strictMode: process.env.NODE_ENV === 'development',
  validateAccessibility: true,
  logIssues: process.env.NODE_ENV === 'development',
  minimumScore: 80
};

export class UIConsistencyManager {
  private config: UIConsistencyConfig;
  private validationHistory: Map<string, UIConsistencyValidationResult[]> = new Map();

  constructor(config: Partial<UIConsistencyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate button consistency
   */
  public validateButton(element: HTMLButtonElement): UIConsistencyValidationResult {
    const result: UIConsistencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    const computedStyle = window.getComputedStyle(element);
    const classList = Array.from(element.classList);

    // Check minimum touch target size (44x44px)
    const rect = element.getBoundingClientRect();
    if (rect.width < 44 || rect.height < 44) {
      result.errors.push('Button does not meet minimum touch target size (44x44px)');
      result.score -= 20;
    }

    // Check for consistent border radius
    const borderRadius = computedStyle.borderRadius;
    if (!borderRadius.includes('9999px') && !borderRadius.includes('50%')) {
      result.suggestions.push('Consider using rounded-full for consistent button styling');
      result.score -= 5;
    }

    // Check for focus styles
    if (!classList.some(cls => cls.includes('focus:'))) {
      result.warnings.push('Button missing focus styles for accessibility');
      result.score -= 15;
    }

    // Check for disabled styles
    if (!classList.some(cls => cls.includes('disabled:'))) {
      result.warnings.push('Button missing disabled state styles');
      result.score -= 10;
    }

    // Check for transition styles
    if (!classList.some(cls => cls.includes('transition'))) {
      result.suggestions.push('Consider adding transition styles for better UX');
      result.score -= 5;
    }

    // Check for consistent color scheme
    const hasConsistentColors = classList.some(cls => 
      cls.includes('bg-game-primary') || 
      cls.includes('bg-neutral-') || 
      cls.includes('bg-red-') ||
      cls.includes('bg-white') ||
      cls.includes('bg-transparent')
    );
    
    if (!hasConsistentColors) {
      result.warnings.push('Button may not follow consistent color scheme');
      result.score -= 10;
    }

    result.isValid = result.errors.length === 0 && result.score >= this.config.minimumScore;
    return result;
  }

  /**
   * Validate popup consistency
   */
  public validatePopup(element: HTMLElement): UIConsistencyValidationResult {
    const result: UIConsistencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    const computedStyle = window.getComputedStyle(element);
    const classList = Array.from(element.classList);

    // Check for proper z-index
    const zIndex = parseInt(computedStyle.zIndex);
    if (zIndex < 1000) {
      result.warnings.push('Popup z-index may be too low, consider using z-[9999] or higher');
      result.score -= 15;
    }

    // Check for backdrop
    const parent = element.parentElement;
    if (parent && !parent.classList.contains('fixed')) {
      result.errors.push('Popup should have a fixed positioned backdrop overlay');
      result.score -= 25;
    }

    // Check for proper ARIA attributes
    if (!element.getAttribute('role') || element.getAttribute('role') !== 'dialog') {
      result.errors.push('Popup missing role="dialog" attribute');
      result.score -= 20;
    }

    if (!element.getAttribute('aria-modal')) {
      result.errors.push('Popup missing aria-modal="true" attribute');
      result.score -= 15;
    }

    // Check for consistent styling
    const hasConsistentStyling = classList.some(cls => 
      cls.includes('rounded-') && 
      (cls.includes('bg-white') || cls.includes('bg-[#1a2332]'))
    );

    if (!hasConsistentStyling) {
      result.warnings.push('Popup may not follow consistent styling patterns');
      result.score -= 10;
    }

    result.isValid = result.errors.length === 0 && result.score >= this.config.minimumScore;
    return result;
  }

  /**
   * Validate navigation consistency
   */
  public validateNavigation(element: HTMLElement): UIConsistencyValidationResult {
    const result: UIConsistencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    const computedStyle = window.getComputedStyle(element);
    const classList = Array.from(element.classList);

    // Check for proper navigation role
    if (!element.getAttribute('role') || element.getAttribute('role') !== 'navigation') {
      result.errors.push('Navigation element missing role="navigation"');
      result.score -= 20;
    }

    // Check for aria-label
    if (!element.getAttribute('aria-label')) {
      result.warnings.push('Navigation element should have aria-label for accessibility');
      result.score -= 15;
    }

    // Check for consistent positioning
    const position = computedStyle.position;
    if (position !== 'fixed') {
      result.suggestions.push('Consider using fixed positioning for consistent navigation placement');
      result.score -= 5;
    }

    // Check for consistent styling
    const hasConsistentStyling = classList.some(cls => 
      cls.includes('bg-white') || cls.includes('bg-[#1a2332]')
    );

    if (!hasConsistentStyling) {
      result.warnings.push('Navigation may not follow consistent styling patterns');
      result.score -= 10;
    }

    result.isValid = result.errors.length === 0 && result.score >= this.config.minimumScore;
    return result;
  }

  /**
   * Validate accessibility compliance
   */
  public validateAccessibility(element: HTMLElement): UIConsistencyValidationResult {
    const result: UIConsistencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    const isInteractive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
    const tabIndex = element.getAttribute('tabindex');

    // Check keyboard accessibility
    if (isInteractive && tabIndex === '-1') {
      result.warnings.push('Interactive element may not be keyboard accessible (tabindex="-1")');
      result.score -= 15;
    }

    // Check for accessible names
    if (isInteractive) {
      const hasAccessibleName = 
        element.getAttribute('aria-label') ||
        element.getAttribute('aria-labelledby') ||
        element.textContent?.trim();

      if (!hasAccessibleName) {
        result.errors.push('Interactive element missing accessible name');
        result.score -= 25;
      }
    }

    // Check for focus indicators
    const classList = Array.from(element.classList);
    if (isInteractive && !classList.some(cls => cls.includes('focus:'))) {
      result.errors.push('Interactive element missing focus indicators');
      result.score -= 20;
    }

    // Check for minimum touch target size on interactive elements
    if (isInteractive) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        result.errors.push('Interactive element does not meet minimum touch target size (44x44px)');
        result.score -= 20;
      }
    }

    result.isValid = result.errors.length === 0 && result.score >= this.config.minimumScore;
    return result;
  }

  /**
   * Validate error feedback consistency
   */
  public validateErrorFeedback(element: HTMLElement): UIConsistencyValidationResult {
    const result: UIConsistencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    const classList = Array.from(element.classList);

    // Check for proper ARIA attributes
    if (!element.getAttribute('role') || element.getAttribute('role') !== 'dialog') {
      result.errors.push('Error feedback missing role="dialog" attribute');
      result.score -= 20;
    }

    if (!element.getAttribute('aria-labelledby')) {
      result.warnings.push('Error feedback should have aria-labelledby pointing to title');
      result.score -= 10;
    }

    if (!element.getAttribute('aria-describedby')) {
      result.warnings.push('Error feedback should have aria-describedby pointing to message');
      result.score -= 10;
    }

    // Check for consistent styling
    const hasOverlay = element.parentElement?.classList.contains('fixed');
    if (!hasOverlay) {
      result.errors.push('Error feedback should have a backdrop overlay');
      result.score -= 25;
    }

    // Check for severity-appropriate styling
    const hasSeverityColors = classList.some(cls => 
      cls.includes('border-red-') || 
      cls.includes('border-yellow-') || 
      cls.includes('border-blue-') ||
      cls.includes('border-green-')
    );

    if (!hasSeverityColors) {
      result.warnings.push('Error feedback should use severity-appropriate colors');
      result.score -= 15;
    }

    result.isValid = result.errors.length === 0 && result.score >= this.config.minimumScore;
    return result;
  }

  /**
   * Comprehensive UI consistency validation
   */
  public validateUIConsistency(
    element: HTMLElement, 
    componentType?: UIComponentType
  ): UIConsistencyValidationResult {
    const results: UIConsistencyValidationResult[] = [];

    // Determine component type if not provided
    if (!componentType) {
      if (element.tagName === 'BUTTON') {
        componentType = 'button';
      } else if (element.getAttribute('role') === 'dialog') {
        componentType = 'popup';
      } else if (element.getAttribute('role') === 'navigation') {
        componentType = 'navigation';
      } else if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
        componentType = 'input';
      }
    }

    // Run specific validations
    if (componentType === 'button' && element.tagName === 'BUTTON') {
      results.push(this.validateButton(element as HTMLButtonElement));
    }
    if (componentType === 'popup') {
      results.push(this.validatePopup(element));
    }
    if (componentType === 'navigation') {
      results.push(this.validateNavigation(element));
    }
    if (componentType === 'error-feedback') {
      results.push(this.validateErrorFeedback(element));
    }

    // Always run accessibility validation
    if (this.config.validateAccessibility) {
      results.push(this.validateAccessibility(element));
    }

    // Combine results
    const combinedResult: UIConsistencyValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    let totalScore = 0;
    let scoreCount = 0;

    results.forEach(result => {
      combinedResult.errors.push(...result.errors);
      combinedResult.warnings.push(...result.warnings);
      combinedResult.suggestions.push(...result.suggestions);
      
      if (!result.isValid) {
        combinedResult.isValid = false;
      }

      totalScore += result.score;
      scoreCount++;
    });

    // Calculate average score
    combinedResult.score = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 100;
    combinedResult.isValid = combinedResult.errors.length === 0 && combinedResult.score >= this.config.minimumScore;

    // Store validation history
    const elementId = element.id || element.tagName.toLowerCase();
    if (!this.validationHistory.has(elementId)) {
      this.validationHistory.set(elementId, []);
    }
    this.validationHistory.get(elementId)!.push(combinedResult);

    // Log issues if enabled
    if (this.config.logIssues) {
      this.logValidationResult(elementId, combinedResult);
    }

    return combinedResult;
  }

  /**
   * Get standardized component classes
   */
  public getStandardizedClasses(componentType: UIComponentType, options: any = {}): string {
    switch (componentType) {
      case 'button':
        return getButtonClasses(
          options.variant || 'primary',
          options.size || 'md',
          options.fullWidth || false,
          options.loading || false,
          options.className || ''
        );
      
      case 'navigation':
        return getNavigationItemClasses(
          options.isActive || false,
          options.className || ''
        );
      
      case 'input':
        return getInputClasses(
          options.size || 'md',
          options.className || ''
        );
      
      case 'popup':
        return options.section ? POPUP_STYLES[options.section as keyof typeof POPUP_STYLES] : POPUP_STYLES.container;
      
      default:
        return options.className || '';
    }
  }

  /**
   * Get validation history for an element
   */
  public getValidationHistory(elementId: string): UIConsistencyValidationResult[] {
    return this.validationHistory.get(elementId) || [];
  }

  /**
   * Get overall consistency score across all validated elements
   */
  public getOverallConsistencyScore(): number {
    const allResults = Array.from(this.validationHistory.values()).flat();
    if (allResults.length === 0) return 100;

    const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / allResults.length);
  }

  /**
   * Clear validation history
   */
  public clearValidationHistory(): void {
    this.validationHistory.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<UIConsistencyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log validation result to console
   */
  private logValidationResult(elementId: string, result: UIConsistencyValidationResult): void {
    const prefix = `[UI Consistency] ${elementId}:`;
    
    if (result.errors.length > 0) {
      console.error(`${prefix} Errors:`, result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn(`${prefix} Warnings:`, result.warnings);
    }
    if (result.suggestions.length > 0) {
      console.info(`${prefix} Suggestions:`, result.suggestions);
    }
    
    console.log(`${prefix} Consistency Score: ${result.score}/100`);
  }
}

/**
 * Global UI consistency manager instance
 */
export const uiConsistencyManager = new UIConsistencyManager();

/**
 * React hook for UI consistency validation
 */
export function useUIConsistencyValidation(
  elementRef: React.RefObject<HTMLElement>,
  componentType?: UIComponentType,
  enabled = process.env.NODE_ENV === 'development'
) {
  const [validationResult, setValidationResult] = React.useState<UIConsistencyValidationResult | null>(null);

  React.useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;
    const result = uiConsistencyManager.validateUIConsistency(element, componentType);
    setValidationResult(result);
  }, [enabled, elementRef, componentType]);

  return validationResult;
}

/**
 * React hook for getting standardized classes
 */
export function useStandardizedClasses(componentType: UIComponentType, options: any = {}) {
  return React.useMemo(() => {
    return uiConsistencyManager.getStandardizedClasses(componentType, options);
  }, [componentType, options]);
}