// Groups-list signed-in home.
// Spec: 02-UI-SPEC.md §"Groups list" (lines 350-362); §Copywriting Contract rows
// 162-165, 226-243 for the exact copy strings.
//
// Two visual states:
//   • Empty: title + avatar profile shortcut, ScreenHeader + two CTAs.
//   • Populated: title + '+' icon + kebab menu, FlatList with pull-to-refresh.

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import {
  useGroupsList,
  type GroupsListRow,
} from '../../src/features/groups/useGroupsList';
import { labelFor } from '../../src/features/groups/timezones';
import { useSession } from '../../src/features/auth/AuthProvider';
import { useProfile } from '../../src/features/profile/useProfile';
import { useTheme } from '../../src/theme/useTheme';
import {
  ScreenContainer,
  ScreenHeader,
  PrimaryButton,
  GhostButton,
  Avatar,
} from '../../src/components';

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

  const openKebab = () => {
    Alert.alert('More', undefined, [
      {
        text: 'Join with a code',
        onPress: () => router.push('/groups/join'),
      },
      {
        text: 'Profile',
        onPress: () => router.push('/profile'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    </ScreenContainer>
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
