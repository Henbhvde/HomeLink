type ExistingOAuthAccount = {
  isActive: boolean;
  oauthProvider: string | null;
  oauthSubject: string | null;
};

export const newGoogleUserRole = 'unassigned' as const;
export const newGoogleUserNeedsOnboarding = true;

export function oauthLinkIssue(user: ExistingOAuthAccount, provider: string, subject: string) {
  if (!user.isActive) return { status: 403, message: 'This account has been disabled.' };
  if ((user.oauthProvider || user.oauthSubject)
    && (user.oauthProvider !== provider || user.oauthSubject !== subject)) {
    return { status: 409, message: 'This email is already linked to another OAuth account.' };
  }
  return null;
}

export function isUniqueConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
