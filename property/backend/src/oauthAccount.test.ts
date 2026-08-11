import { describe, expect, it } from 'vitest';
import { isUniqueConflict, newGoogleUserNeedsOnboarding, newGoogleUserRole, oauthLinkIssue } from './oauthAccount.js';

describe('OAuth account linking', () => {
  it('keeps new Google users unassigned and sends them to role selection', () => {
    expect(newGoogleUserRole).toBe('unassigned');
    expect(newGoogleUserRole).not.toBe('manager');
    expect(newGoogleUserNeedsOnboarding).toBe(true);
  });

  it('allows an unlinked active account', () => {
    expect(oauthLinkIssue({ isActive: true, oauthProvider: null, oauthSubject: null }, 'google', 'sub-1')).toBeNull();
  });

  it('rejects disabled and differently linked accounts', () => {
    expect(oauthLinkIssue({ isActive: false, oauthProvider: null, oauthSubject: null }, 'google', 'sub-1')?.status).toBe(403);
    expect(oauthLinkIssue({ isActive: true, oauthProvider: 'google', oauthSubject: 'sub-2' }, 'google', 'sub-1')?.status).toBe(409);
  });

  it('detects duplicate database writes', () => {
    expect(isUniqueConflict({ code: 'P2002' })).toBe(true);
  });
});
