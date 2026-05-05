import type { ExpoConfig } from 'expo/config';

// Note: Some SDK 55 runtime fields (newArchEnabled, edgeToEdgeEnabled) are not yet in
// @expo/config-types typings. Cast keeps strict tsc happy without losing runtime config.
const config: ExpoConfig = {
  name: 'Accountibuzz',
  slug: 'accountibuzz',
  scheme: 'accountibuzz', // D-12 + Pitfall 5 (password-reset deep link)
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic', // supports OS light/dark per UI-SPEC
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.accountibuzz.mobile',
  },
  android: {
    package: 'app.accountibuzz.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'Accountibuzz needs camera access to capture your daily proof.',
        microphonePermission: 'Accountibuzz needs microphone access to record audio with your video proof.',
        recordAudioAndroid: true,
      },
    ],
    // Generic hook for iOS/Android native build tweaks. No options set yet —
    // installed in Phase 3 UAT for future native config (deploymentTarget,
    // useFrameworks, extraPods, etc.) without another package add.
    'expo-build-properties',
    // Xcode 15+ User Script Sandboxing breaks the React Native "Bundle code
    // and images" build phase on iOS device builds (ip.txt file-write-create
    // sandbox deny). Plugin sets ENABLE_USER_SCRIPT_SANDBOXING = NO on every
    // XCBuildConfiguration so the setting survives `expo prebuild --clean`.
    './plugins/withDisableScriptSandbox',
  ],
  // Runtime-only fields (typed loosely to satisfy strict TS while keeping SDK 55 features)
  ...({ newArchEnabled: true } as Record<string, unknown>),
};

(config.android as Record<string, unknown>).edgeToEdgeEnabled = true;

export default config;
