/**
 * AccessControlManager Service
 * Provides unified permission validation across all entry points
 * 
 * Requirements: 3.1, 3.2, 3.5 - Consistent access control for create functionality
 */

import type { AnyUserProfile } from '../../shared/models/user.types';
import type { UserPermissions } from '../types/navigation.types';
import { isGuestProfile } from '../../shared/models/user.types';

/**
 * Access control result for validation operations
 */
export interface AccessControlResult {
  /** Whether access is granted */
  granted: boolean;
  
  /** Reason for denial (if access is not granted) */
  reason?: 'GUEST_USER' | 'INSUFFICIENT_LEVEL' | 'PERMISSION_DENIED' | 'SESSION_EXPIRED';
  
  /** Human-readable message for the user */
  message?: string;
  
  /** Suggested actions for the user */
  suggestedActions?: string[];
  
  /** Redirect information for failed access attempts */
  redirect?: {
    /** Target view to redirect to */
    targetView: 'menu' | 'login' | 'profile';
    /** Delay in milliseconds before redirect (0 for immediate) */
    delay?: number;
    /** Whether to show the error message before redirecting */
    showMessageBeforeRedirect?: boolean;
  };
}

/**
 * Entry point types for access control tracking
 */
export type AccessEntryPoint = 
  | 'navigation_tab'
  | 'create_button'
  | 'direct_link'
  | 'menu_option'
  | 'keyboard_shortcut';

/**
 * Access control configuration
 */
interface AccessControlConfig {
  /** Minimum level required for create access */
  minLevelForCreate: number;
  
  /** Whether guests can access create functionality */
  allowGuestCreate: boolean;
  
  /** Whether to show detailed error messages */
  showDetailedErrors: boolean;
}

/**
 * AccessControlManager Class
 * Manages all access control validation and provides consistent messaging
 */
export class AccessControlManager {
  private config: AccessControlConfig;

  constructor(config?: Partial<AccessControlConfig>) {
    this.config = {
      minLevelForCreate: 3,
      allowGuestCreate: false,
      showDetailedErrors: true,
      ...config
    };
  }

  /**
   * Validate create access for a user
   * Requirements: 3.1, 3.2 - Block guests and players under level 3
   */
  public validateCreateAccess(
    user: AnyUserProfile, 
    entryPoint: AccessEntryPoint = 'direct_link'
  ): AccessControlResult {
    try {
      // Check if user is a guest
      if (isGuestProfile(user)) {
        return this.createAccessDeniedResult('GUEST_USER', entryPoint);
      }

      // Check user level requirement
      if (user.level < this.config.minLevelForCreate) {
        return this.createAccessDeniedResult('INSUFFICIENT_LEVEL', entryPoint, user.level);
      }

      // Access granted
      return {
        granted: true
      };
    } catch (error) {
      console.error('Error validating create access:', error);
      return this.createAccessDeniedResult('PERMISSION_DENIED', entryPoint);
    }
  }

  /**
   * Get user permissions object for a given user
   * Requirements: 3.5 - Set up UserPermissions model and validation logic
   */
  public getUserPermissions(user: AnyUserProfile): UserPermissions {
    const isGuest = isGuestProfile(user);
    const userId = isGuest ? user.id : user.user_id;
    
    return {
      userId,
      level: user.level,
      isGuest,
      canCreateChallenges: this.validateCreateAccess(user).granted,
      accessRestrictions: this.getAccessRestrictions(user)
    };
  }

  /**
   * Get consistent access denied message for different scenarios
   * Requirements: 3.1, 3.2, 3.3 - Consistent popup messaging
   */
  public getAccessDeniedMessage(
    reason: AccessControlResult['reason'], 
    entryPoint: AccessEntryPoint,
    userLevel?: number
  ): string {
    switch (reason) {
      case 'GUEST_USER':
        return this.getGuestAccessMessage(entryPoint);
      
      case 'INSUFFICIENT_LEVEL':
        return this.getInsufficientLevelMessage(entryPoint, userLevel);
      
      case 'SESSION_EXPIRED':
        return 'Your session has expired. Please log in again to create challenges.';
      
      case 'PERMISSION_DENIED':
      default:
        return 'You do not have permission to create challenges at this time.';
    }
  }

  /**
   * Get suggested actions for access denial
   * Requirements: 3.6 - Redirect users to appropriate alternative actions
   */
  public getSuggestedActions(
    reason: AccessControlResult['reason'], 
    entryPoint: AccessEntryPoint
  ): string[] {
    switch (reason) {
      case 'GUEST_USER':
        return [
          'Log in with your Reddit account',
          'Continue playing to reach level 3',
          'Browse existing challenges'
        ];
      
      case 'INSUFFICIENT_LEVEL':
        return [
          'Play more challenges to level up',
          'Check your current level in Profile',
          'Browse existing challenges'
        ];
      
      case 'SESSION_EXPIRED':
        return [
          'Log in again',
          'Refresh the page',
          'Return to menu'
        ];
      
      case 'PERMISSION_DENIED':
      default:
        return [
          'Return to menu',
          'Contact support if this seems wrong',
          'Try again later'
        ];
    }
  }

  /**
   * Get redirect information for failed access attempts
   * Requirements: 3.6 - Redirect users to appropriate alternative actions or login prompts
   */
  public getRedirectInfo(
    reason: AccessControlResult['reason'], 
    entryPoint: AccessEntryPoint
  ): AccessControlResult['redirect'] {
    switch (reason) {
      case 'GUEST_USER':
        return {
          targetView: 'menu',
          delay: 3000, // 3 seconds to read the message
          showMessageBeforeRedirect: true
        };
      
      case 'INSUFFICIENT_LEVEL':
        return {
          targetView: 'menu',
          delay: 2500, // 2.5 seconds to read the message
          showMessageBeforeRedirect: true
        };
      
      case 'SESSION_EXPIRED':
        return {
          targetView: 'login',
          delay: 2000, // 2 seconds to read the message
          showMessageBeforeRedirect: true
        };
      
      case 'PERMISSION_DENIED':
      default:
        return {
          targetView: 'menu',
          delay: 2000,
          showMessageBeforeRedirect: true
        };
    }
  }

  /**
   * Handle access control failure with appropriate error messaging and redirects
   * Requirements: 3.6 - Clear error messaging and appropriate redirects for unauthorized users
   */
  public handleAccessFailure(
    user: AnyUserProfile,
    entryPoint: AccessEntryPoint,
    onRedirect?: (targetView: 'menu' | 'login' | 'profile') => void,
    onError?: (error: string) => void
  ): AccessControlResult {
    const result = this.validateCreateAccess(user, entryPoint);
    
    if (result.granted) {
      return result;
    }

    // Enhanced error handling for different failure scenarios
    try {
      // Log access failure for security monitoring
      console.warn('Access control failure:', {
        reason: result.reason,
        entryPoint,
        userId: isGuestProfile(user) ? user.id : user.user_id,
        timestamp: new Date().toISOString()
      });

      // Handle session expiry scenario
      if (result.reason === 'SESSION_EXPIRED') {
        if (onError) {
          onError('Your session has expired. Please log in again to continue.');
        }
        
        // Immediate redirect for session expiry
        if (onRedirect) {
          setTimeout(() => {
            onRedirect('login');
          }, result.redirect?.delay || 0);
        }
        
        return result;
      }

      // Handle other access failures with appropriate redirects
      if (result.redirect && onRedirect) {
        if (result.redirect.showMessageBeforeRedirect && result.message) {
          // Show message first, then redirect
          setTimeout(() => {
            onRedirect(result.redirect!.targetView);
          }, result.redirect.delay || 0);
        } else {
          // Immediate redirect
          onRedirect(result.redirect.targetView);
        }
      }

      return result;
    } catch (error) {
      // Error handling for unexpected failures
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error in access control failure handling:', error);
      
      if (onError) {
        onError(`Access validation failed: ${errorMessage}`);
      }
      
      // Fallback redirect to menu on error
      if (onRedirect) {
        setTimeout(() => {
          onRedirect('menu');
        }, 1000);
      }
      
      return {
        granted: false,
        reason: 'PERMISSION_DENIED',
        message: 'An error occurred while validating access. Please try again.',
        suggestedActions: ['Return to menu', 'Try again later', 'Refresh the page'],
        redirect: {
          targetView: 'menu',
          delay: 1000,
          showMessageBeforeRedirect: true
        }
      };
    }
  }

  /**
   * Validate session and handle expiry scenarios
   * Requirements: 3.6 - Handle session expiry and invalid permission scenarios
   */
  public async validateSession(
    user: AnyUserProfile,
    onSessionExpired?: () => void
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // For guest users, session is always valid (they don't have server sessions)
      if (isGuestProfile(user)) {
        return { valid: true };
      }

      // For authenticated users, we could add session validation logic here
      // This would typically involve checking with the server or validating tokens
      // For now, we'll assume sessions are valid unless explicitly expired
      
      // In a real implementation, you might check:
      // - Token expiry
      // - Server-side session validation
      // - User permissions changes
      
      return { valid: true };
    } catch (error) {
      console.error('Session validation error:', error);
      
      if (onSessionExpired) {
        onSessionExpired();
      }
      
      return { 
        valid: false, 
        reason: 'Session validation failed' 
      };
    }
  }

  /**
   * Block unauthorized access and show appropriate feedback
   * Requirements: 3.3 - Same blocking mechanism across all entry points
   */
  public blockUnauthorizedAccess(
    user: AnyUserProfile, 
    entryPoint: AccessEntryPoint,
    onBlock?: (result: AccessControlResult) => void
  ): AccessControlResult {
    const result = this.validateCreateAccess(user, entryPoint);
    
    if (!result.granted && onBlock) {
      onBlock(result);
    }
    
    return result;
  }

  /**
   * Update access control configuration
   */
  public updateConfig(updates: Partial<AccessControlConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
  }

  /**
   * Get current access control configuration
   */
  public getConfig(): AccessControlConfig {
    return { ...this.config };
  }

  /**
   * Create access denied result with consistent messaging
   */
  private createAccessDeniedResult(
    reason: AccessControlResult['reason'], 
    entryPoint: AccessEntryPoint,
    userLevel?: number
  ): AccessControlResult {
    return {
      granted: false,
      reason,
      message: this.getAccessDeniedMessage(reason, entryPoint, userLevel),
      suggestedActions: this.getSuggestedActions(reason, entryPoint),
      redirect: this.getRedirectInfo(reason, entryPoint)
    };
  }

  /**
   * Get guest-specific access message
   */
  private getGuestAccessMessage(entryPoint: AccessEntryPoint): string {
    const baseMessage = 'You need to be logged in to create challenges.';
    
    switch (entryPoint) {
      case 'navigation_tab':
        return `${baseMessage} Log in with your Reddit account to start creating!`;
      
      case 'create_button':
        return `${baseMessage} Creating challenges requires a Reddit account.`;
      
      case 'menu_option':
        return `${baseMessage} Sign in to unlock challenge creation.`;
      
      default:
        return baseMessage;
    }
  }

  /**
   * Get insufficient level message
   */
  private getInsufficientLevelMessage(entryPoint: AccessEntryPoint, userLevel?: number): string {
    const levelText = userLevel !== undefined ? ` (currently level ${userLevel})` : '';
    const baseMessage = `You need to reach level ${this.config.minLevelForCreate}${levelText} to create challenges.`;
    
    switch (entryPoint) {
      case 'navigation_tab':
        return `${baseMessage} Keep playing to level up!`;
      
      case 'create_button':
        return `${baseMessage} Play more challenges to unlock creation.`;
      
      case 'menu_option':
        return `${baseMessage} Level up by solving more challenges!`;
      
      default:
        return baseMessage;
    }
  }

  /**
   * Get access restrictions for a user
   */
  private getAccessRestrictions(user: AnyUserProfile): string[] {
    const restrictions: string[] = [];
    
    if (isGuestProfile(user)) {
      restrictions.push('GUEST_USER');
    }
    
    if (user.level < this.config.minLevelForCreate) {
      restrictions.push('INSUFFICIENT_LEVEL');
    }
    
    return restrictions;
  }
}

/**
 * Default access control manager instance
 */
export const accessControlManager = new AccessControlManager();