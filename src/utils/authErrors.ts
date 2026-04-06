import { FirebaseError } from 'firebase/app';

// Errors that map to the password field
const PASSWORD_FIELD_CODES = new Set([
  'auth/wrong-password',
  'auth/invalid-credential',
]);

// Errors that map to the email field
const EMAIL_FIELD_CODES = new Set([
  'auth/user-not-found',
  'auth/email-already-in-use',
  'auth/invalid-email',
]);

const ERROR_MESSAGES: Record<string, string> = {
  'auth/wrong-password':          'Incorrect password.',
  'auth/invalid-credential':      'Incorrect email or password.',
  'auth/user-not-found':          'No account found with this email.',
  'auth/email-already-in-use':    'An account with this email already exists.',
  'auth/invalid-email':           'Please enter a valid email address.',
  'auth/weak-password':           'Password must be at least 6 characters.',
  'auth/network-request-failed':  'Network error. Check your connection and try again.',
  'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
  'auth/operation-not-allowed':   'Email/password sign-in is not enabled. Contact support.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export type AuthErrorTarget = 'email' | 'password' | 'banner';

export interface MappedAuthError {
  message: string;
  target: AuthErrorTarget;
}

export function mapAuthError(error: unknown): MappedAuthError {
  if (error instanceof FirebaseError) {
    const message = ERROR_MESSAGES[error.code] ?? FALLBACK;
    const target: AuthErrorTarget = PASSWORD_FIELD_CODES.has(error.code)
      ? 'password'
      : EMAIL_FIELD_CODES.has(error.code)
      ? 'email'
      : 'banner';
    return { message, target };
  }
  return { message: FALLBACK, target: 'banner' };
}
