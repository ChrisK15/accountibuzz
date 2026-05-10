// app/(app)/capture/_layout.tsx
// Nested Stack inside Tabs.Screen — restores modal presentation for the
// capture screen after the P3 commit 298fe64 inline-fix that ripped out
// Stack-only options to resolve the Tabs sceneStyleInterpolator crash.
//
// Closes 03-VERIFICATION item 1 (D-05..D-07).
//
// Expo Router auto-discovers this nested layout via the directory structure.
// The outer app/(app)/_layout.tsx Tabs.Screen registration stays unchanged
// (href: null is preserved — capture stays tab-bar-hidden, just now backed
// by an inner Stack that owns the modal presentation options).
//
// @see 03.1-CONTEXT.md §D-05..D-07
// @see 03.1-RESEARCH.md §Pattern 1
// @see docs.expo.dev/router/advanced/modals/
import { Stack } from 'expo-router';

export default function CaptureLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        animation: 'slide_from_bottom',
        gestureEnabled: false,
        headerShown: false,
      }}
    />
  );
}
