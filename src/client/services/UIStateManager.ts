/**
 * UIStateManager Service
 * Handles UI state preservation and context management
 * 
 * Requirements: 2.3, 2.5, 4.1, 4.2 - State preservation and context management
 */

import type { GuideState } from '../types/navigation.types';

export interface UIContext {
  /** Unique identifier for this context */
  id: string;
  
  /** Timestamp when context was created */
  createdAt: Date;
  
  /** Form data preserved in this context */
  formData: Record<string, any>;
  
  /** Page-specific context data */
  pageContext: {
    /** Current page/view identifier */
    pageId: string;
    
    /** Scroll position */
    scrollPosition: { x: number; y: number };
    
    /** Active element focus */
    activeElementId?: string;
    
    /** Any page-specific state */
    pageState?: Record<string, any>;
  };
  
  /** User interaction context */
  userContext: {
    /** User's current session data */
    sessionData?: Record<string, any>;
    
    /** User preferences for this session */
    preferences?: Record<string, any>;
    
    /** Navigation history within this context */
    navigationHistory: string[];
  };
}

export class UIStateManager {
  private contexts: Map<string, UIContext> = new Map();
  private guideStates: Map<string, GuideState> = new Map();
  private maxContexts = 10; // Limit memory usage
  
  /**
   * Preserve form data and create a UI context
   * Requirements: 2.5 - Preserve form data during guide interactions
   */
  public preserveFormData(pageId: string, additionalData?: Record<string, any>): string {
    const formData = this.extractFormData();
    const contextId = this.generateContextId();
    
    const context: UIContext = {
      id: contextId,
      createdAt: new Date(),
      formData: { ...formData, ...additionalData },
      pageContext: {
        pageId,
        scrollPosition: this.getScrollPosition(),
        activeElementId: this.getActiveElementId(),
        pageState: additionalData
      },
      userContext: {
        navigationHistory: this.getNavigationHistory()
      }
    };
    
    this.contexts.set(contextId, context);
    this.cleanupOldContexts();
    
    return contextId;
  }

  /**
   * Restore user context from a preserved context
   * Requirements: 4.2 - Restore challenge to its last known state
   */
  public restoreUserContext(contextId: string): UIContext | null {
    const context = this.contexts.get(contextId);
    
    if (!context) {
      console.warn(`UI context ${contextId} not found or expired`);
      return null;
    }
    
    // Restore form data
    this.restoreFormData(context.formData);
    
    // Restore scroll position
    this.restoreScrollPosition(context.pageContext.scrollPosition);
    
    // Restore focus if possible
    if (context.pageContext.activeElementId) {
      this.restoreFocus(context.pageContext.activeElementId);
    }
    
    return context;
  }

  /**
   * Preserve guide state
   * Requirements: 2.2, 2.3 - Guide expansion without page refresh and state preservation
   */
  public preserveGuideState(guideId: string, state: GuideState): void {
    this.guideStates.set(guideId, { ...state });
  }

  /**
   * Restore guide state
   */
  public restoreGuideState(guideId: string): GuideState | null {
    return this.guideStates.get(guideId) || null;
  }

  /**
   * Update guide state
   */
  public updateGuideState(guideId: string, updates: Partial<GuideState>): void {
    const currentState = this.guideStates.get(guideId);
    if (currentState) {
      this.guideStates.set(guideId, { ...currentState, ...updates });
    }
  }

  /**
   * Get preserved form data for a specific context
   */
  public getPreservedFormData(contextId: string): Record<string, any> | null {
    const context = this.contexts.get(contextId);
    return context ? { ...context.formData } : null;
  }

  /**
   * Clear a specific context
   */
  public clearContext(contextId: string): void {
    this.contexts.delete(contextId);
  }

  /**
   * Clear all contexts (useful for logout or session reset)
   */
  public clearAllContexts(): void {
    this.contexts.clear();
    this.guideStates.clear();
  }

  /**
   * Get all active context IDs
   */
  public getActiveContextIds(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Check if a context exists
   */
  public hasContext(contextId: string): boolean {
    return this.contexts.has(contextId);
  }

  /**
   * Preserve current page state for navigation
   * Requirements: 4.1 - Preserve player's overall session state
   */
  public preservePageState(pageId: string): string {
    const contextId = this.preserveFormData(pageId);
    
    // Add additional page-specific state
    const context = this.contexts.get(contextId);
    if (context) {
      context.pageContext.pageState = {
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
      
      this.contexts.set(contextId, context);
    }
    
    return contextId;
  }

  /**
   * Preserve navigation session state
   * Requirements: 4.1 - Preserve player's overall session state during navigation
   */
  public preserveNavigationSession(challengeId: string, navigationData?: Record<string, any>): string {
    const contextId = this.preservePageState(`navigation_${challengeId}`);
    
    // Add navigation-specific data to the context
    const context = this.contexts.get(contextId);
    if (context && navigationData) {
      // Ensure sessionData exists before spreading
      const existingSessionData = context.userContext.sessionData || {};
      context.userContext.sessionData = {
        ...existingSessionData,
        navigationData,
        challengeId,
        preservedAt: new Date().toISOString()
      };
      this.contexts.set(contextId, context);
    }
    
    return contextId;
  }

  /**
   * Restore challenge state for previously visited challenges
   * Requirements: 4.2 - Restore challenge to its last known state
   */
  public restoreChallengeState(challengeId: string): {
    context: UIContext | null;
    challengeData?: Record<string, any>;
    lastVisited?: Date;
  } {
    // Find the most recent context for this challenge
    const challengeContexts = Array.from(this.contexts.entries())
      .filter(([, context]) => 
        context.pageContext.pageId.includes(`navigation_${challengeId}`) ||
        context.userContext.sessionData?.challengeId === challengeId
      )
      .sort(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime());

    if (challengeContexts.length === 0) {
      return { context: null };
    }

    const [contextId, context] = challengeContexts[0];
    const restoredContext = this.restoreUserContext(contextId);
    
    return {
      context: restoredContext,
      challengeData: context.userContext.sessionData?.navigationData,
      lastVisited: context.createdAt
    };
  }

  /**
   * Integrate with navigation manager for seamless state preservation
   * Requirements: 4.1, 4.2 - Session state and challenge state preservation
   */
  public integrateWithNavigation(navigationManager: any): {
    preserveNavigationState: (challengeId: string) => string;
    restoreNavigationState: (challengeId: string) => boolean;
    syncFormData: () => void;
    preservePageRefreshState: (challengeId: string) => string;
    recoverPageRefreshState: (challengeId?: string) => boolean;
  } {
    return {
      preserveNavigationState: (challengeId: string) => {
        const navigationContext = navigationManager.getNavigationContext?.();
        return this.preserveNavigationSession(challengeId, navigationContext);
      },
      
      restoreNavigationState: (challengeId: string) => {
        const restoration = this.restoreChallengeState(challengeId);
        if (restoration.context && restoration.challengeData) {
          // Restore navigation context if available
          if (navigationManager.restoreNavigationContext && restoration.challengeData.contextId) {
            navigationManager.restoreNavigationContext(restoration.challengeData.contextId);
          }
          return true;
        }
        return false;
      },
      
      syncFormData: () => {
        const preservedData = navigationManager.getPreservedFormData?.();
        if (preservedData) {
          // Sync form data between navigation manager and UI state manager
          const currentPageId = window.location.pathname.replace('/', '') || 'home';
          this.preserveFormData(currentPageId, preservedData);
        }
      },
      
      preservePageRefreshState: (challengeId: string) => {
        const navigationContext = navigationManager.getNavigationContext?.();
        return this.preservePageRefreshContext(challengeId, navigationContext);
      },
      
      recoverPageRefreshState: (challengeId?: string) => {
        const recovery = this.recoverPageRefreshContext(challengeId);
        if (recovery.recovered && recovery.context && recovery.challengeId) {
          // Sync recovered state with navigation manager
          if (navigationManager.restoreNavigationContext && recovery.context.userContext.sessionData) {
            navigationManager.restoreNavigationContext(recovery.context.userContext.sessionData.contextId);
          }
          return true;
        }
        return false;
      }
    };
  }

  /**
   * Implement page refresh context persistence
   * Requirements: 4.4 - Maintain challenge context where possible during page refresh
   */
  public preservePageRefreshContext(challengeId: string, navigationData?: Record<string, any>): string {
    const contextId = this.preserveNavigationSession(challengeId, navigationData);
    
    // Store context in both session storage and local storage for redundancy
    const context = this.contexts.get(contextId);
    if (context) {
      const persistenceData = {
        context,
        challengeId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      
      try {
        // Session storage for current session
        const sessionKey = `page_refresh_context_${challengeId}`;
        sessionStorage.setItem(sessionKey, JSON.stringify(persistenceData));
        
        // Local storage for longer persistence (with expiration)
        const localKey = `page_refresh_context_${challengeId}`;
        const localData = {
          ...persistenceData,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };
        localStorage.setItem(localKey, JSON.stringify(localData));
        
        // Store current challenge ID for quick recovery
        sessionStorage.setItem('current_challenge_id', challengeId);
        
      } catch (error) {
        console.warn('Failed to persist page refresh context:', error);
      }
    }
    
    return contextId;
  }

  /**
   * Recover context after page refresh
   * Requirements: 4.4 - Handle page refresh scenarios with context recovery
   */
  public recoverPageRefreshContext(challengeId?: string): {
    recovered: boolean;
    challengeId?: string;
    context?: UIContext;
    fallbackData?: Record<string, any>;
    message: string;
  } {
    // Try to determine challenge ID if not provided
    const targetChallengeId = challengeId || sessionStorage.getItem('current_challenge_id');
    
    if (!targetChallengeId) {
      return {
        recovered: false,
        message: 'No challenge ID available for recovery'
      };
    }
    
    // Try session storage first (most recent)
    const sessionKey = `page_refresh_context_${targetChallengeId}`;
    const sessionData = sessionStorage.getItem(sessionKey);
    
    if (sessionData) {
      try {
        const persistenceData = JSON.parse(sessionData);
        const recoveredContext = persistenceData.context as UIContext;
        
        // Restore context to memory
        this.contexts.set(recoveredContext.id, recoveredContext);
        
        return {
          recovered: true,
          challengeId: targetChallengeId,
          context: recoveredContext,
          fallbackData: recoveredContext.formData,
          message: 'Context recovered from session storage'
        };
      } catch (error) {
        console.warn('Failed to parse session storage context:', error);
      }
    }
    
    // Try local storage as fallback
    const localKey = `page_refresh_context_${targetChallengeId}`;
    const localData = localStorage.getItem(localKey);
    
    if (localData) {
      try {
        const persistenceData = JSON.parse(localData);
        
        // Check if data has expired
        if (persistenceData.expiresAt && new Date(persistenceData.expiresAt) < new Date()) {
          localStorage.removeItem(localKey);
          return this.handleContextLoss('expired');
        }
        
        const recoveredContext = persistenceData.context as UIContext;
        
        // Restore context to memory
        this.contexts.set(recoveredContext.id, recoveredContext);
        
        return {
          recovered: true,
          challengeId: targetChallengeId,
          context: recoveredContext,
          fallbackData: recoveredContext.formData,
          message: 'Context recovered from local storage'
        };
      } catch (error) {
        console.warn('Failed to parse local storage context:', error);
      }
    }
    
    // Fallback to context loss handling
    return this.handleContextLoss(targetChallengeId);
  }

  /**
   * Initialize page refresh recovery on application start
   * Requirements: 4.4 - Implement fallback mechanisms for context loss
   */
  public initializePageRefreshRecovery(): {
    recovered: boolean;
    challengeId?: string;
    context?: UIContext;
    message: string;
  } {
    // Check if we're recovering from a page refresh
    const currentChallengeId = sessionStorage.getItem('current_challenge_id');
    
    if (!currentChallengeId) {
      return {
        recovered: false,
        message: 'No previous session to recover'
      };
    }
    
    const recovery = this.recoverPageRefreshContext(currentChallengeId);
    
    if (recovery.recovered && recovery.context) {
      // Restore form data to the page if possible
      this.restoreFormData(recovery.context.formData);
      
      // Restore scroll position
      this.restoreScrollPosition(recovery.context.pageContext.scrollPosition);
      
      // Restore focus if possible
      if (recovery.context.pageContext.activeElementId) {
        this.restoreFocus(recovery.context.pageContext.activeElementId);
      }
      
      return {
        recovered: true,
        challengeId: recovery.challengeId,
        context: recovery.context,
        message: recovery.message
      };
    }
    
    return {
      recovered: false,
      message: recovery.message
    };
  }

  /**
   * Clean up expired page refresh contexts
   * Requirements: 4.4 - Implement fallback mechanisms for context loss
   */
  public cleanupExpiredPageRefreshContexts(): void {
    try {
      // Clean up expired local storage contexts
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('page_refresh_context_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key)!);
            if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
              keysToRemove.push(key);
            }
          } catch (error) {
            // Invalid data, mark for removal
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clean up old session storage contexts (keep only current session)
      const currentChallengeId = sessionStorage.getItem('current_challenge_id');
      const sessionKeysToRemove: string[] = [];
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('page_refresh_context_') && key !== `page_refresh_context_${currentChallengeId}`) {
          sessionKeysToRemove.push(key);
        }
      }
      
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      
    } catch (error) {
      console.warn('Failed to cleanup expired contexts:', error);
    }
  }

  /**
   * Handle context loss scenarios
   * Requirements: Error handling for context loss
   */
  public handleContextLoss(contextId: string): {
    recovered: boolean;
    fallbackData?: Record<string, any>;
    message: string;
  } {
    // Try to recover from session storage
    const sessionKey = `ui_context_${contextId}`;
    const sessionData = sessionStorage.getItem(sessionKey);
    
    if (sessionData) {
      try {
        const recoveredContext = JSON.parse(sessionData) as UIContext;
        this.contexts.set(contextId, recoveredContext);
        
        return {
          recovered: true,
          fallbackData: recoveredContext.formData,
          message: 'Context recovered from session storage'
        };
      } catch (error) {
        console.error('Failed to recover context from session storage:', error);
      }
    }
    
    // Try to recover basic form data from DOM
    const currentFormData = this.extractFormData();
    if (Object.keys(currentFormData).length > 0) {
      return {
        recovered: false,
        fallbackData: currentFormData,
        message: 'Partial recovery: current form data available'
      };
    }
    
    return {
      recovered: false,
      message: 'Context lost and could not be recovered'
    };
  }

  /**
   * Extract form data from the current page
   */
  private extractFormData(): Record<string, any> {
    const formData: Record<string, any> = {};
    
    // Get all form elements
    const formElements = document.querySelectorAll('input, textarea, select');
    
    formElements.forEach((element) => {
      const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const key = input.name || input.id;
      
      if (key) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          formData[key] = (input as HTMLInputElement).checked;
        } else if (input.type === 'file') {
          // For file inputs, we can't preserve the actual files, but we can note that they existed
          formData[key] = (input as HTMLInputElement).files?.length || 0;
        } else {
          formData[key] = input.value;
        }
      }
    });
    
    return formData;
  }

  /**
   * Restore form data to the page
   */
  private restoreFormData(formData: Record<string, any>): void {
    Object.entries(formData).forEach(([key, value]) => {
      const element = document.querySelector(`[name="${key}"], [id="${key}"]`) as 
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      
      if (element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
          (element as HTMLInputElement).checked = Boolean(value);
        } else if (element.type !== 'file') { // Skip file inputs
          element.value = String(value || '');
          
          // Trigger change event to notify React/other frameworks
          const changeEvent = new Event('change', { bubbles: true });
          element.dispatchEvent(changeEvent);
        }
      }
    });
  }

  /**
   * Get current scroll position
   */
  private getScrollPosition(): { x: number; y: number } {
    return {
      x: window.scrollX || window.pageXOffset,
      y: window.scrollY || window.pageYOffset
    };
  }

  /**
   * Restore scroll position
   */
  private restoreScrollPosition(position: { x: number; y: number }): void {
    window.scrollTo(position.x, position.y);
  }

  /**
   * Get currently active element ID
   */
  private getActiveElementId(): string | undefined {
    const activeElement = document.activeElement;
    return activeElement?.id || undefined;
  }

  /**
   * Restore focus to an element
   */
  private restoreFocus(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element && typeof element.focus === 'function') {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        element.focus();
      }, 100);
    }
  }

  /**
   * Get navigation history from browser
   */
  private getNavigationHistory(): string[] {
    // In a real implementation, this might track custom navigation history
    // For now, we'll return the current URL
    return [window.location.href];
  }

  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up automatic page refresh context preservation
   * Requirements: 4.4 - Maintain challenge context where possible during page refresh
   */
  public setupPageRefreshPersistence(): void {
    // Set up beforeunload event to preserve context
    window.addEventListener('beforeunload', () => {
      const currentChallengeId = sessionStorage.getItem('current_challenge_id');
      if (currentChallengeId) {
        this.preservePageRefreshContext(currentChallengeId);
      }
    });
    
    // Set up periodic cleanup of expired contexts
    setInterval(() => {
      this.cleanupExpiredPageRefreshContexts();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Set up visibility change handler for additional persistence
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const currentChallengeId = sessionStorage.getItem('current_challenge_id');
        if (currentChallengeId) {
          this.preservePageRefreshContext(currentChallengeId);
        }
      }
    });
  }

  /**
   * Update current challenge ID for page refresh recovery
   * Requirements: 4.4 - Handle page refresh scenarios with context recovery
   */
  public setCurrentChallengeId(challengeId: string): void {
    try {
      sessionStorage.setItem('current_challenge_id', challengeId);
    } catch (error) {
      console.warn('Failed to set current challenge ID:', error);
    }
  }

  /**
   * Get current challenge ID for page refresh recovery
   */
  public getCurrentChallengeId(): string | null {
    try {
      return sessionStorage.getItem('current_challenge_id');
    } catch (error) {
      console.warn('Failed to get current challenge ID:', error);
      return null;
    }
  }

  /**
   * Clean up old contexts to prevent memory leaks
   */
  private cleanupOldContexts(): void {
    const contextEntries = Array.from(this.contexts.entries());
    
    if (contextEntries.length > this.maxContexts) {
      // Sort by creation date and remove oldest
      contextEntries
        .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, contextEntries.length - this.maxContexts)
        .forEach(([contextId]) => {
          this.contexts.delete(contextId);
          
          // Also remove from session storage if it exists
          const sessionKey = `ui_context_${contextId}`;
          sessionStorage.removeItem(sessionKey);
        });
    }
    
    // Also save current contexts to session storage for recovery
    contextEntries.slice(-5).forEach(([contextId, context]) => {
      const sessionKey = `ui_context_${contextId}`;
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(context));
      } catch (error) {
        console.warn('Failed to save context to session storage:', error);
      }
    });
  }
}

// Export singleton instance
export const uiStateManager = new UIStateManager();