import { useContext, useState } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { register, signIn, sendVerificationEmail } from '@/services/firebase/authService';
import { mapAuthError, MappedAuthError } from '@/utils/authErrors';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '@/types/user';

interface UseAuthReturn {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  profileComplete: boolean;
  loading: boolean;
  isSubmitting: boolean;
  bannerError: string | null;
  clearErrors: () => void;
  registerUser: (email: string, password: string) => Promise<MappedAuthError | null>;
  signInUser: (email: string, password: string) => Promise<MappedAuthError | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  function clearErrors() {
    setBannerError(null);
  }

  async function registerUser(email: string, password: string): Promise<MappedAuthError | null> {
    clearErrors();
    setIsSubmitting(true);
    try {
      await register(email, password);
      try { await sendVerificationEmail(); } catch { /* best-effort */ }
      return null;
    } catch (e) {
      const mapped = mapAuthError(e);
      if (mapped.target === 'banner') setBannerError(mapped.message);
      return mapped;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInUser(email: string, password: string): Promise<MappedAuthError | null> {
    clearErrors();
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      return null;
    } catch (e) {
      const mapped = mapAuthError(e);
      if (mapped.target === 'banner') setBannerError(mapped.message);
      return mapped;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    ...ctx,
    isSubmitting,
    bannerError,
    clearErrors,
    registerUser,
    signInUser,
  };
}
