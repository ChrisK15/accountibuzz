// App-shell layout — bottom-tabs migration (Plan 03-06 / D-14).
// Spec: 03-UI-SPEC.md §"App shell — Stack → Tabs migration" (lines 703-732);
//       03-RESEARCH.md §Code Examples §10 (verbatim Tabs pattern).
//
// Three primary tabs: Today / Groups / Profile (Feather sun/users/user).
// Non-tab routes (groups/new, groups/join, groups/[id]/index, groups/[id]/review,
// capture/[groupId]) are registered with `href: null` so they remain routable
// via router.push but do NOT appear in the tab bar.
//
// The capture/[groupId] route is registered with presentation: 'fullScreenModal'
// + animation: 'slide_from_bottom' + gestureEnabled: false (UI-SPEC line 786, 951).
// The screen file itself ships in Plan 03-07.
//
// Tab visuals follow UI-SPEC §"Tab-bar visuals" (lines 721-728): surface bg,
// 1px border top hairline, 56pt + safe-area height, active text/textStrong,
// inactive textMuted. The 2pt yellow active-tab indicator (line 723) is
// deferred to Plan 03-08 polish — Expo Router's <Tabs> doesn't ship a
// per-active-tab top indicator out of the box and the workaround (full
// custom tabBar component) is non-trivial.

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';

export default function AppLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
        },
        tabBarActiveTintColor: t.colors.text,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: t.fonts.caption.fontFamily,
          fontSize: 13,
        },
      }}
    >
      {/* ── Visible tabs ──────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <Feather name="sun" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups/index"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color }) => (
            <Feather name="users" color={color} size={22} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Feather name="user" color={color} size={22} />
          ),
        }}
      />

      {/* ── Hidden routes (still routable via router.push) ───── */}
      <Tabs.Screen name="groups/new" options={{ href: null }} />
      <Tabs.Screen name="groups/join" options={{ href: null }} />
      <Tabs.Screen name="groups/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="groups/[id]/review" options={{ href: null }} />
      {/* Phase 03.1-02 added app/(app)/capture/_layout.tsx (nested Stack with
          modal presentation). Once the folder has its own _layout, Expo Router
          treats `capture` as a single nested route group — `href: null` must
          target the folder name, not the inner [groupId] file, otherwise a
          phantom "Capture" tab appears in the bar. */}
      <Tabs.Screen name="capture" options={{ href: null }} />
    </Tabs>
  );
}
