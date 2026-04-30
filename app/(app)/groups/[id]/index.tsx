// Group-detail screen — header, (admin) invite panel, members, destructive zone.
// Spec: 02-UI-SPEC.md §"Group detail" (lines 381-399), §"Copywriting Contract"
// all modals (lines 171-208, 282-288), §"Destructive action confirmations"
// (lines 278-288), §"Interaction Contracts" (lines 442-461).
//
// Invariants (NON-NEGOTIABLE):
//   • Every <Modal> passes a context-specific cancelLabel per the copywriting
//     table: 'Stay in group', 'Never mind', 'Keep my admin role',
//     'Keep the group', 'Keep current code'.
//   • Admin invite panel gated on isAdmin && activeInvite; non-admins never
//     see it even if the hook accidentally returns a row (server RLS also
//     protects this — defense in depth).
//   • Post-create banner: SecureStore key `seen_create_banner:{group_id}`,
//     8s auto-hide, never shown again for the same group.

import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionSheetIOS,
  Alert,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useGroup } from '../../../../src/features/groups/useGroup';
import {
  useGroupMembers,
  type MemberRow,
} from '../../../../src/features/groups/useGroupMembers';
import { useActiveInvite } from '../../../../src/features/groups/useActiveInvite';
import { useLeaveGroup } from '../../../../src/features/groups/useLeaveGroup';
import { useTransferAdmin } from '../../../../src/features/groups/useTransferAdmin';
import { useDeleteGroup } from '../../../../src/features/groups/useDeleteGroup';
import { useRegenerateInvite } from '../../../../src/features/groups/useRegenerateInvite';
import { shareInvite } from '../../../../src/features/groups/shareInvite';
import { usePendingReviewCount } from '../../../../src/features/submissions/usePendingReviewCount';
import { labelFor } from '../../../../src/features/groups/timezones';
import { useSession } from '../../../../src/features/auth/AuthProvider';
import { useTheme } from '../../../../src/theme/useTheme';
import { supabase } from '../../../../src/lib/supabase';
import {
  ScreenContainer,
  Avatar,
  PrimaryButton,
  DestructiveTextButton,
  InviteCodeChip,
  Modal,
} from '../../../../src/components';

// WR-01: append `?v={updated_at}` so expo-image busts its URL cache after a
// member uploads a new avatar to the stable `{userId}/avatar.jpg` path.
function avatarUrlFor(
  path: string | null | undefined,
  updatedAt?: string | null,
): string | null {
  if (!path) return null;
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  return updatedAt ? `${base}?v=${encodeURIComponent(updatedAt)}` : base;
}

type ModalKind =
  | null
  | 'member-leave'
  | 'admin-leave-branch'
  | 'transfer-picker'
  | 'delete-confirm'
  | 'regenerate-confirm'
  // WR-05: Android-only action sheet for the admin kebab. iOS uses the
  // native ActionSheetIOS; Android RN `Alert.alert` silently drops buttons
  // beyond the 3rd on some OEM skins, so we render a custom list sheet.
  | 'kebab-admin-android'
  | 'kebab-member-android';

export default function GroupDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const { data: group, isPending: groupPending } = useGroup(id);
  const { data: members, isPending: membersPending } = useGroupMembers(id);
  const { data: activeInvite } = useActiveInvite(id);
  const leave = useLeaveGroup();
  const transfer = useTransferAdmin();
  const del = useDeleteGroup();
  const regen = useRegenerateInvite();

  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedTransferTarget, setSelectedTransferTarget] = useState<
    string | null
  >(null);
  const [showCreatedBanner, setShowCreatedBanner] = useState(false);
  const [showRegenBanner, setShowRegenBanner] = useState(false);
  const [transferredAdminName, setTransferredAdminName] = useState<string | null>(
    null,
  );

  const createdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin =
    !!user && !!group && group.admin_user_id === user.id;
  const bannerKey = `seen_create_banner:${id ?? ''}`;

  // PendingReviewRow gate (Plan 03-06) — admin-only entry above InviteCodePanel.
  // Server-side RPC returns 0 for non-admins (D-17 0-leak invariant), so even if
  // a non-admin somehow lands here, count === 0 hides the row. Defense in depth.
  const { data: pendingCount } = usePendingReviewCount(id);
  const showPendingRow = isAdmin && (pendingCount ?? 0) > 0;
  const countLabel =
    (pendingCount ?? 0) > 9 ? '9+' : String(pendingCount ?? 0);

  // Post-create banner: show once per group, 8s auto-hide.
  useEffect(() => {
    if (!isAdmin || !id) return;
    let alive = true;
    SecureStore.getItemAsync(bannerKey)
      .then((seen) => {
        if (!alive || seen) return;
        setShowCreatedBanner(true);
        SecureStore.setItemAsync(bannerKey, '1').catch(() => {});
        createdTimerRef.current = setTimeout(() => {
          setShowCreatedBanner(false);
        }, 8000);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (createdTimerRef.current !== null) {
        clearTimeout(createdTimerRef.current);
        createdTimerRef.current = null;
      }
    };
  }, [isAdmin, id, bannerKey]);

  useEffect(() => {
    return () => {
      if (regenTimerRef.current !== null) clearTimeout(regenTimerRef.current);
    };
  }, []);

  if (groupPending || membersPending || !group || !members) {
    return <GroupDetailSkeleton />;
  }

  const onShare = async () => {
    if (!activeInvite) return;
    await shareInvite(group.name, activeInvite.code);
  };

  const onLeaveTap = () =>
    setModal(isAdmin ? 'admin-leave-branch' : 'member-leave');
  const onTransferTap = () => {
    setSelectedTransferTarget(null);
    setModal('transfer-picker');
  };
  const onDeleteTap = () => setModal('delete-confirm');
  const onRegenerateTap = () => setModal('regenerate-confirm');

  const memberLeaveConfirm = async () => {
    if (!id) return;
    try {
      await leave.mutateAsync(id);
      setModal(null);
      router.replace('/groups');
    } catch (err) {
      setModal(null);
      Alert.alert(
        'Error',
        err instanceof Error
          ? err.message
          : "Something went wrong. Nothing's changed — try again.",
      );
    }
  };

  const transferConfirm = async () => {
    if (!id || !selectedTransferTarget) return;
    const newAdminName =
      members.find((m) => m.user_id === selectedTransferTarget)?.display_name ??
      'them';
    try {
      await transfer.mutateAsync({
        group_id: id,
        new_admin_user_id: selectedTransferTarget,
      });
      setTransferredAdminName(newAdminName);
      setModal(null);
    } catch (err) {
      setModal(null);
      Alert.alert(
        'Error',
        err instanceof Error
          ? err.message
          : "Something went wrong. Nothing's changed — try again.",
      );
    }
  };

  const deleteConfirm = async () => {
    if (!id) return;
    try {
      await del.mutateAsync(id);
      setModal(null);
      router.replace('/groups');
    } catch (err) {
      setModal(null);
      Alert.alert(
        'Error',
        err instanceof Error
          ? err.message
          : "Something went wrong. Nothing's changed — try again.",
      );
    }
  };

  const regenerateConfirm = async () => {
    if (!id) return;
    try {
      await regen.mutateAsync(id);
      setModal(null);
      setShowCreatedBanner(false);
      setShowRegenBanner(true);
      if (regenTimerRef.current !== null) clearTimeout(regenTimerRef.current);
      regenTimerRef.current = setTimeout(() => {
        setShowRegenBanner(false);
      }, 8000);
    } catch (err) {
      setModal(null);
      Alert.alert(
        'Error',
        err instanceof Error
          ? err.message
          : "Couldn't make a new code. Try again.",
      );
    }
  };

  // WR-05: Kebab uses native ActionSheetIOS on iOS (HIG-compliant for >2
  // choices with a destructive action) and a custom list modal on Android
  // (RN `Alert.alert` only honors 3 buttons on Android, silently dropping
  // the 4th on some OEM skins).
  const onKebabTap = () => {
    if (Platform.OS === 'ios') {
      if (isAdmin) {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Regenerate code', 'Transfer admin', 'Delete group', 'Cancel'],
            cancelButtonIndex: 3,
            destructiveButtonIndex: 2,
            title: 'More',
          },
          (idx) => {
            if (idx === 0) onRegenerateTap();
            else if (idx === 1) onTransferTap();
            else if (idx === 2) onDeleteTap();
          },
        );
      } else {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Leave group', 'Cancel'],
            cancelButtonIndex: 1,
            destructiveButtonIndex: 0,
            title: 'More',
          },
          (idx) => {
            if (idx === 0) onLeaveTap();
          },
        );
      }
    } else {
      // Android: show a custom list modal (see Modals section below).
      setModal(isAdmin ? 'kebab-admin-android' : 'kebab-member-android');
    }
  };

  const memberAtCap = members.length === 10;
  const soloAdmin = isAdmin && members.length === 1;

  return (
    <ScreenContainer>
      {/* Nav bar: back + kebab */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: t.spacing.lg,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Feather
            name="chevron-left"
            size={28}
            color={t.colors.textStrong}
          />
        </Pressable>
        <Pressable
          onPress={onKebabTap}
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

      <ScrollView
        contentContainerStyle={{
          paddingBottom: t.spacing['2xl'],
          gap: t.spacing.xl,
        }}
      >
        {/* Header block */}
        <View>
          <Text
            style={[t.fonts.display, { color: t.colors.textStrong }]}
            numberOfLines={2}
          >
            {group.name}
          </Text>
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.textMuted, marginTop: t.spacing.sm },
            ]}
          >
            {group.goal}
          </Text>
          <Text
            style={[
              t.fonts.caption,
              { color: t.colors.textMuted, marginTop: t.spacing.md },
            ]}
          >
            {`${members.length} of 10 members · ${
              group.submission_type === 'photo' ? 'Photo' : 'Video'
            } · ${labelFor(group.timezone)}`}
          </Text>
        </View>

        {/* Transfer success banner (not in P1 spec but UI-SPEC line 274 lists it) */}
        {transferredAdminName && (
          <InlineBanner
            text={`${transferredAdminName} is now the admin.`}
            onDismiss={() => setTransferredAdminName(null)}
          />
        )}

        {/* Post-create banner (admin only, one-time per group) */}
        {showCreatedBanner && (
          <InlineBanner
            text="Group created — share the code to invite friends."
            onDismiss={() => {
              if (createdTimerRef.current !== null) {
                clearTimeout(createdTimerRef.current);
                createdTimerRef.current = null;
              }
              setShowCreatedBanner(false);
            }}
          />
        )}

        {showRegenBanner && (
          <InlineBanner
            text="New code ready — share it with anyone who hasn't joined yet."
            onDismiss={() => {
              if (regenTimerRef.current !== null) {
                clearTimeout(regenTimerRef.current);
                regenTimerRef.current = null;
              }
              setShowRegenBanner(false);
            }}
          />
        )}

        {/* PendingReviewRow — admin-only entry above InviteCodePanel.
            UI-SPEC §"Pending-review entry" (lines 838-858) + 03-PATTERNS.md
            (lines 643-681). Hidden when count === 0 OR user is not admin.
            ADM-01 + PLAT-03 (UI gate; RPC also returns 0 for non-admins). */}
        {showPendingRow && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Pending review, ${countLabel} ${
              pendingCount === 1 ? 'submission' : 'submissions'
            }`}
            accessibilityHint="Opens the review queue for this group"
            onPress={() => router.push(`/groups/${id}/review`)}
            style={({ pressed }) => ({
              backgroundColor: pressed
                ? t.colors.surfaceMuted
                : t.colors.surface,
              borderRadius: t.radii.md,
              borderWidth: 1,
              borderColor: t.colors.border,
              padding: t.spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              // e1 elevation per UI-SPEC line 845
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 2,
            })}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[t.fonts.heading2, { color: t.colors.textStrong }]}
              >
                {`Pending review (${countLabel})`}
              </Text>
              <Text
                style={[
                  t.fonts.body,
                  { color: t.colors.textMuted, marginTop: t.spacing.xs },
                ]}
              >
                Tap to approve or reject submissions
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={22}
              color={t.colors.textMuted}
            />
          </Pressable>
        )}

        {/* Admin invite panel */}
        {isAdmin && activeInvite && (
          <View
            style={{
              backgroundColor: t.colors.surface,
              borderRadius: t.radii.lg,
              padding: t.spacing.lg,
              gap: t.spacing.md,
              borderWidth: 1,
              borderColor: t.colors.border,
            }}
          >
            <Text style={[t.fonts.caption, { color: t.colors.textMuted }]}>
              Invite code
            </Text>
            <InviteCodeChip code={activeInvite.code} />
            <PrimaryButton label="Share code" onPress={onShare} />
            <Pressable
              onPress={onRegenerateTap}
              accessibilityRole="button"
              accessibilityLabel="Regenerate code"
              style={{ alignSelf: 'flex-end', paddingVertical: t.spacing.sm }}
            >
              <Text
                style={[
                  t.fonts.body,
                  { color: t.colors.accent, fontWeight: '700' },
                ]}
              >
                Regenerate code
              </Text>
            </Pressable>
          </View>
        )}

        {/* Members section */}
        <View>
          <Text
            style={[
              t.fonts.caption,
              { color: t.colors.textMuted, marginBottom: t.spacing.md },
            ]}
          >
            {`Members (${members.length})`}
          </Text>
          {members.map((m) => (
            <MemberRowItem
              key={m.user_id}
              member={m}
              isSelf={m.user_id === user?.id}
            />
          ))}
          {soloAdmin && (
            <Text
              style={[
                t.fonts.caption,
                { color: t.colors.textMuted, marginTop: t.spacing.md },
              ]}
            >
              Just you so far — share your code to bring friends in.
            </Text>
          )}
          {memberAtCap && (
            <Text
              style={[
                t.fonts.body,
                { color: t.colors.textMuted, marginTop: t.spacing.md },
              ]}
            >
              Your group&apos;s full — 10 is the cap for now.
            </Text>
          )}
        </View>

        {/* Bottom destructive zone */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            paddingTop: t.spacing['2xl'],
            gap: t.spacing.lg,
            alignItems: 'center',
          }}
        >
          {!isAdmin && (
            <DestructiveTextButton label="Leave group" onPress={onLeaveTap} />
          )}
          {isAdmin && (
            <>
              <Pressable
                onPress={onTransferTap}
                accessibilityRole="button"
                accessibilityLabel="Transfer admin"
              >
                <Text
                  style={[
                    t.fonts.body,
                    { color: t.colors.accent, fontWeight: '700' },
                  ]}
                >
                  Transfer admin
                </Text>
              </Pressable>
              <DestructiveTextButton
                label="Delete group"
                onPress={onDeleteTap}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Modals ───────────────────────────────────────────────── */}

      <Modal
        visible={modal === 'member-leave'}
        onDismiss={() => setModal(null)}
        title={`Leave ${group.name}?`}
        body={
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, textAlign: 'center' },
            ]}
          >
            You&apos;ll lose access to the group&apos;s feed and your streak
            resets if you come back.
          </Text>
        }
        primaryAction={{
          label: 'Leave group',
          onPress: memberLeaveConfirm,
          variant: 'destructive',
          loading: leave.isPending,
        }}
        cancelLabel="Stay in group"
      />

      <Modal
        visible={modal === 'admin-leave-branch'}
        onDismiss={() => setModal(null)}
        title="Admins can't just leave"
        body={
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, textAlign: 'center' },
            ]}
          >
            Hand the group to someone else, or delete it entirely.
          </Text>
        }
        primaryAction={{
          label: 'Transfer admin instead',
          onPress: () => {
            setSelectedTransferTarget(null);
            setModal('transfer-picker');
          },
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Delete the group',
          onPress: () => setModal('delete-confirm'),
          variant: 'destructive-text',
        }}
        cancelLabel="Never mind"
      />

      <Modal
        visible={modal === 'transfer-picker'}
        onDismiss={() => setModal(null)}
        title="Pick a new admin"
        body={
          <TransferPickerList
            members={members.filter((m) => m.user_id !== user?.id)}
            selected={selectedTransferTarget}
            onSelect={setSelectedTransferTarget}
          />
        }
        primaryAction={{
          label: selectedTransferTarget
            ? `Transfer to ${
                members.find((m) => m.user_id === selectedTransferTarget)
                  ?.display_name ?? 'them'
              }`
            : 'Pick a member',
          onPress: selectedTransferTarget ? transferConfirm : () => {},
          variant: 'primary',
          loading: transfer.isPending,
        }}
        cancelLabel="Keep my admin role"
      />

      <Modal
        visible={modal === 'delete-confirm'}
        onDismiss={() => setModal(null)}
        title="Delete this group?"
        body={
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, textAlign: 'center' },
            ]}
          >
            Everyone loses access. Submissions, members, and invites are gone.
            This can&apos;t be undone.
          </Text>
        }
        primaryAction={{
          label: 'Delete group',
          onPress: deleteConfirm,
          variant: 'destructive',
          loading: del.isPending,
        }}
        cancelLabel="Keep the group"
      />

      <Modal
        visible={modal === 'regenerate-confirm'}
        onDismiss={() => setModal(null)}
        title="Make a new code?"
        body={
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, textAlign: 'center' },
            ]}
          >
            The current code stops working right away. Anyone who hasn&apos;t
            joined yet will need the new one.
          </Text>
        }
        primaryAction={{
          label: 'Regenerate',
          onPress: regenerateConfirm,
          variant: 'primary',
          loading: regen.isPending,
        }}
        cancelLabel="Keep current code"
      />

      {/* WR-05: Android-only kebab action sheets. RN `Alert.alert` on Android
          honors at most 3 buttons (positive/negative/neutral); the 4th is
          silently dropped on some OEM skins. iOS uses ActionSheetIOS directly. */}
      <KebabSheetAndroid
        visible={modal === 'kebab-admin-android'}
        onDismiss={() => setModal(null)}
        items={[
          {
            label: 'Regenerate code',
            onPress: () => {
              setModal(null);
              onRegenerateTap();
            },
          },
          {
            label: 'Transfer admin',
            onPress: () => {
              setModal(null);
              onTransferTap();
            },
          },
          {
            label: 'Delete group',
            destructive: true,
            onPress: () => {
              setModal(null);
              onDeleteTap();
            },
          },
        ]}
      />
      <KebabSheetAndroid
        visible={modal === 'kebab-member-android'}
        onDismiss={() => setModal(null)}
        items={[
          {
            label: 'Leave group',
            destructive: true,
            onPress: () => {
              setModal(null);
              onLeaveTap();
            },
          },
        ]}
      />
    </ScreenContainer>
  );
}

// WR-05: Android kebab action sheet. Custom list modal because the Modal
// primitive requires a primaryAction and at most one secondary, which doesn't
// fit a flat list of 3 choices.
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

// ── Helpers ──────────────────────────────────────────────────────

function InlineBanner({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        padding: t.spacing.lg,
        gap: t.spacing.md,
      }}
    >
      <Text
        style={[t.fonts.body, { color: t.colors.text, flex: 1 }]}
      >
        {text}
      </Text>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
      >
        <Feather name="x" size={20} color={t.colors.textMuted} />
      </Pressable>
    </View>
  );
}

function MemberRowItem({
  member,
  isSelf,
}: {
  member: MemberRow;
  isSelf: boolean;
}) {
  const t = useTheme();
  const name = member.display_name ?? 'Unnamed';
  const imageUri = avatarUrlFor(member.avatar_path, member.updated_at);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: t.spacing.md,
        gap: t.spacing.md,
      }}
    >
      <Avatar name={name} imageUri={imageUri} size={40} />
      <View style={{ flex: 1 }}>
        <Text
          style={[t.fonts.body, { color: t.colors.textStrong }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {isSelf && (
          <Text style={[t.fonts.caption, { color: t.colors.textMuted }]}>
            You
          </Text>
        )}
      </View>
      {member.role === 'admin' && (
        <View
          accessibilityLabel="Admin"
          style={{
            backgroundColor: t.colors.primary,
            paddingHorizontal: t.spacing.sm,
            paddingVertical: t.spacing.xs,
            borderRadius: t.radii.pill,
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope_500Medium',
              fontSize: 13,
              lineHeight: 18,
              letterSpacing: 0.5,
              color: t.colors.primaryFg,
              textTransform: 'uppercase',
            }}
          >
            Admin
          </Text>
        </View>
      )}
    </View>
  );
}

function TransferPickerList({
  members,
  selected,
  onSelect,
}: {
  members: MemberRow[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  if (members.length === 0) {
    return (
      <Text
        style={[
          t.fonts.body,
          { color: t.colors.textMuted, textAlign: 'center' },
        ]}
      >
        No one else is in the group yet.
      </Text>
    );
  }
  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text
        style={[
          t.fonts.body,
          { color: t.colors.text, textAlign: 'center' },
        ]}
      >
        They&apos;ll take over the group. You&apos;ll stay as a member.
      </Text>
      {members.map((m) => {
        const isSelected = selected === m.user_id;
        const name = m.display_name ?? 'Unnamed';
        const imageUri = avatarUrlFor(m.avatar_path, m.updated_at);
        return (
          <Pressable
            key={m.user_id}
            onPress={() => onSelect(m.user_id)}
            accessibilityRole="button"
            accessibilityLabel={`Select ${name}`}
            accessibilityState={{ selected: isSelected }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.md,
              padding: t.spacing.md,
              borderRadius: t.radii.md,
              backgroundColor: isSelected
                ? t.colors.surfaceMuted
                : t.colors.surface,
              borderWidth: 1,
              borderColor: isSelected ? t.colors.accent : t.colors.border,
            }}
          >
            <Avatar name={name} imageUri={imageUri} size={32} />
            <Text
              style={[t.fonts.body, { color: t.colors.textStrong, flex: 1 }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: isSelected ? t.colors.accent : t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: t.colors.accent,
                  }}
                />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function GroupDetailSkeleton() {
  const t = useTheme();
  return (
    <ScreenContainer>
      <View style={{ paddingVertical: t.spacing.lg }}>
        <View
          style={{
            height: 40,
            borderRadius: t.radii.md,
            backgroundColor: t.colors.surfaceMuted,
            marginBottom: t.spacing.lg,
          }}
        />
        <View
          style={{
            height: 140,
            borderRadius: t.radii.lg,
            backgroundColor: t.colors.surfaceMuted,
            marginBottom: t.spacing.xl,
          }}
        />
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              height: 56,
              borderRadius: t.radii.md,
              backgroundColor: t.colors.surfaceMuted,
              marginBottom: t.spacing.sm,
            }}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}
