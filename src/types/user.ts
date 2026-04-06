import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  timezone: string;
  timezoneAutoDetected: boolean;
  fcmToken: string | null;
  notificationIntensity: 'gentle' | 'firm';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Partial type used when writing a new profile doc at setup time
export type CreateUserProfileData = Pick<
  UserProfile,
  'displayName' | 'email' | 'timezone' | 'timezoneAutoDetected'
>;
