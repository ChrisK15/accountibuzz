import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { UserProfile } from '@/types/user';

export async function register(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    await sendEmailVerification(user);
  }
}

// Fetch user profile from Firestore — returns null if not set up yet
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserProfile;
}

// Create or overwrite a user profile doc (used at setup time)
export async function saveUserProfile(uid: string, displayName: string): Promise<void> {
  const user = auth.currentUser;
  await setDoc(doc(db, 'users', uid), {
    uid,
    displayName: displayName.trim(),
    email: user?.email ?? '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneAutoDetected: true,
    fcmToken: null,
    notificationIntensity: 'gentle',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Update display name only (used from settings)
export async function updateUserProfile(uid: string, displayName: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    displayName: displayName.trim(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
