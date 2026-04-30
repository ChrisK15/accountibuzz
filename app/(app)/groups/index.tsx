// Groups-list signed-in tab destination.
// Spec: 02-UI-SPEC.md §"Groups list" (lines 350-362); §Copywriting Contract rows
// 162-165, 226-243 for the exact copy strings.
//
// Two visual states:
//   • Empty: title + avatar profile shortcut, ScreenHeader + two CTAs.
//   • Populated: title + '+' icon + kebab menu, FlatList with pull-to-refresh.
//
// Plan 03-06 file move: this screen was relocated from `app/(app)/index.tsx`
// (where Today screen now lives) to `app/(app)/groups/index.tsx` as part of the
// Stack → Tabs migration (D-14). Content is unchanged; only relative-path
// imports gained one extra `..` for the new nesting depth.

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  FlatList,
  Modal as RNModal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import {
  useGroupsList,
  type GroupsListRow,
} from '../../../src/features/groups/useGroupsList';
import { labelFor } from '../../../src/features/groups/timezones';
import { useSession } from '../../../src/features/auth/AuthProvider';
import { useProfile } from '../../../src/features/profile/useProfile';
import { useTheme } from '../../../src/theme/useTheme';
import {
  ScreenContainer,
  ScreenHeader,
  PrimaryButton,
  GhostButton,
  Avatar,
} from '../../../src/components';

export default function GroupsListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const {
    data: groups,
    isPending,
    isFetching,
    refetch,
  } = useGroupsList();

  const avatarUrl = useMemo(() => {
    if (!profile?.avatar_path) return null;
    return `${
      supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data
        .publicUrl
    }?v=${encodeURIComponent(profile.updated_at)}`;
  }, [profile?.avatar_path, profile?.updated_at]);

  // WR-05: kebab uses native ActionSheetIOS on iOS and a custom list modal
  // on Android (RN Alert.alert is limited to 3 buttons with per-OEM quirks).
  const [kebabOpen, setKebabOpen] = useState(false);
  const openKebab = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Join with a code', 'Profile', 'Cancel'],
          cancelButtonIndex: 2,
          title: 'More',
        },
        (idx) => {
          if (idx === 0) router.push('/groups/join');
          else if (idx === 1) router.push('/profile');
        },
      );
    } else {
      setKebabOpen(true);
    }
  };

  if (isPending) {
    return (
      <ScreenContainer>
        <GroupsListTopBar t={t}>
          <Text style={[t.fonts.heading1, { color: t.colors.textStrong }]}>
            Your groups
          </Text>
          <View />
        </GroupsListTopBar>
        <GroupsListSkeleton />
      </ScreenContainer>
    );
  }

  const isEmpty = !groups || groups.length === 0;

  if (isEmpty) {
    return (
      <ScreenContainer>
        <GroupsListTopBar t={t}>
          <Text style={[t.fonts.heading1, { color: t.colors.textStrong }]}>
            Your groups
          </Text>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            hitSlop={8}
          >
            <Avatar
              name={profile?.display_name ?? ''}
              imageUri={avatarUrl}
              size={40}
            />
          </Pressable>
        </GroupsListTopBar>
        <ScreenHeader
          title="No groups yet"
          subtitle="Start one with friends or hop into theirs."
          align="center"
        />
        <View style={{ gap: t.spacing.lg, marginTop: t.spacing.lg }}>
          <PrimaryButton
            label="Create a group"
            onPress={() => router.push('/groups/new')}
          />
          <GhostButton
            label="Join with a code"
            onPress={() => router.push('/groups/join')}
            accessibilityRole="link"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <GroupsListTopBar t={t}>
        <Text style={[t.fonts.heading1, { color: t.colors.textStrong }]}>
          Your groups
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.lg,
          }}
        >
          <Pressable
            onPress={() => router.push('/groups/new')}
            accessibilityRole="button"
            accessibilityLabel="Create group"
            hitSlop={8}
          >
            <Feather name="plus" size={24} color={t.colors.textStrong} />
          </Pressable>
          <Pressable
            onPress={openKebab}
            accessibilityRole="button"
            accessibilityLabel="More options"
            hitSlop={8}
          >
            <Feather
              name="more-horizontal"
              size={24}
              color={t.colors.textStrong}
            />
          </Pressable>
        </View>
      </GroupsListTopBar>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GroupRow
            row={item}
            onPress={() => router.push(`/groups/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingBottom: t.spacing['2xl'] }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={t.colors.textMuted}
          />
        }
      />
      {/* WR-05: Android kebab list. */}
      <KebabSheetAndroid
        visible={kebabOpen}
        onDismiss={() => setKebabOpen(false)}
        items={[
          {
            label: 'Join with a code',
            onPress: () => {
              setKebabOpen(false);
              router.push('/groups/join');
            },
          },
          {
            label: 'Profile',
            onPress: () => {
              setKebabOpen(false);
              router.push('/profile');
            },
          },
        ]}
      />
    </ScreenContainer>
  );
}

// WR-05: Android kebab action sheet (mirrors the one in groups/[id]/index.tsx).
function KebabSheetAndroid({
  visible,
  onDismiss,
  items,
}: {
  visible: boolean;
  onDismiss: () => void;
  items: Array<{ label: string; onPress: () => void; destructive?: boolean }>;
}) {
  const t = useTheme();
  const scrimBg =
    t.name === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)';
  return (
    <RNModal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: scrimBg,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={() => {
            /* swallow */
          }}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radii.lg,
            borderTopRightRadius: t.radii.lg,
            paddingVertical: t.spacing.md,
          }}
        >
          {items.map((item, idx) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => ({
                paddingVertical: t.spacing.lg,
                paddingHorizontal: t.spacing.xl,
                backgroundColor: pressed ? t.colors.surfaceMuted : 'transparent',
                borderTopWidth: idx === 0 ? 0 : 1,
                borderTopColor: t.colors.border,
              })}
            >
              <Text
                style={[
                  t.fonts.body,
                  {
                    color: item.destructive
                      ? t.colors.destructive
                      : t.colors.textStrong,
                    fontWeight: '600',
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => ({
              paddingVertical: t.spacing.lg,
              paddingHorizontal: t.spacing.xl,
              backgroundColor: pressed ? t.colors.surfaceMuted : 'transparent',
              borderTopWidth: 1,
              borderTopColor: t.colors.border,
            })}
          >
            <Text
              style={[
                t.fonts.body,
                { color: t.colors.textMuted, fontWeight: '500' },
              ]}
            >
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

function GroupsListTopBar({
  t,
  children,
}: {
  t: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: t.spacing.lg,
      }}
    >
      {children}
    </View>
  );
}

function GroupRow({
  row,
  onPress,
}: {
  row: GroupsListRow;
  onPress: () => void;
}) {
  const t = useTheme();
  const memberWord = row.member_count === 1 ? 'member' : 'members';
  const typeLabel = row.submission_type === 'photo' ? 'Photo' : 'Video';
  const tzLabel = labelFor(row.timezone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.member_count} ${memberWord}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? t.colors.surfaceMuted : t.colors.surface,
        borderRadius: t.radii.md,
        padding: t.spacing.lg,
        marginBottom: t.spacing.md,
        borderWidth: 1,
        borderColor: t.colors.border,
      })}
    >
      <Text
        style={[t.fonts.heading2, { color: t.colors.textStrong }]}
        numberOfLines={1}
      >
        {row.name}
      </Text>
      <Text
        style={[
          t.fonts.body,
          { color: t.colors.text, marginTop: t.spacing.xs },
        ]}
        numberOfLines={2}
      >
        {row.goal}
      </Text>
      <Text
        style={[
          t.fonts.caption,
          { color: t.colors.textMuted, marginTop: t.spacing.sm },
        ]}
      >
        {`${row.member_count} ${memberWord} · ${typeLabel} · ${tzLabel}`}
      </Text>
    </Pressable>
  );
}

function GroupsListSkeleton() {
  const t = useTheme();
  return (
    <View style={{ paddingTop: t.spacing.lg }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: 88,
            borderRadius: t.radii.md,
            backgroundColor: t.colors.surfaceMuted,
            marginBottom: t.spacing.md,
          }}
        />
      ))}
    </View>
  );
}
