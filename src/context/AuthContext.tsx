import React, { createContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { UserProfile } from '../types/user';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  profileComplete: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Attempt to fetch Firestore profile (may not exist yet for new registrations)
        // getUserProfile lives in authService and will be implemented fully in SCRUM-11
        // For SCRUM-9, profile will always be null after register — that is expected
        try {
          const { getUserProfile } = await import('../services/firebase/authService');
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
        } catch {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const profileComplete = userProfile !== null && userProfile.displayName.trim().length > 0;

  async function signOut() {
    const { signOut: firebaseSignOut } = await import('firebase/auth');
    await firebaseSignOut(auth);
  }

  async function refreshProfile() {
    if (!firebaseUser) return;
    const { getUserProfile } = await import('../services/firebase/authService');
    const profile = await getUserProfile(firebaseUser.uid);
    setUserProfile(profile);
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userProfile, profileComplete, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
