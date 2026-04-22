import 'react-native-get-random-values'; // MUST be first import — polyfills crypto.getRandomValues for aes-js (T-01-05)
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { LargeSecureStore } from './storage-adapter';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in values from the Supabase Dashboard.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // CRITICAL: must be false on RN (Pitfall 2 / T-01-03)
  },
});

// Pause/resume token refresh across foreground/background (Pitfall 3 / T-01-04)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
