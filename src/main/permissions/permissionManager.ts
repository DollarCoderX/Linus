import type { PermissionLevel } from '../tools/toolRegistry';

export interface PermissionDecision {
  allowed: boolean;
  reason?: string;
  requiresUserConfirmation: boolean;
}

export class PermissionManager {
  evaluate(permission: PermissionLevel): PermissionDecision {
    if (permission === 'dangerous') {
      return {
        allowed: false,
        requiresUserConfirmation: true,
        reason: 'Dangerous actions must be confirmed by the user.'
      };
    }

    if (permission === 'sensitive') {
      return {
        allowed: false,
        requiresUserConfirmation: true,
        reason: 'Sensitive actions require confirmation until settings are implemented.'
      };
    }

    return {
      allowed: true,
      requiresUserConfirmation: false
    };
  }
}
