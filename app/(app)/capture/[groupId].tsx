// Capture flow — state-machine modal for photo + video submissions.
// Spec: 03-UI-SPEC.md §"app/(app)/capture/[groupId].tsx" (lines 784-834);
//       §Capture state matrix (lines 995-1012);
//       §Submit flow error copy (lines 388-397);
//       03-RESEARCH.md §Pattern 5 (state machine, lines 607-636);
//       03-PATTERNS.md §`app/(app)/capture/[groupId].tsx` (lines 718-839).
//
// State machine:
//   permission-request → permission-denied (camera|mic)
//                      → capture (photo idle | video idle | video recording)
//                      → review (photo | video)
//                      → submit-in-flight → success-dismiss
//                                          | network-queue-dismiss
//                                          | typed-error-inline
//
// PER REVIEWS.md C6 (Rules of Hooks):
//   `useVideoPlayer` is called UNCONDITIONALLY at the TOP of the component,
//   BEFORE any early returns (permission-denied branches). Passing `null` /
//   empty source idles the player; the conditional render of <VideoView> in
//   the review state does NOT change the hook call site.
//
// PER REVIEWS.md C7 (post-mutation haptics):
//   `Haptics.notificationAsync(Success)` fires AFTER `await mutateAsync(...)`
//   resolves successfully. Network/queued path: NO haptic (the dismissal IS
//   the feedback). Typed-error path: NO haptic.
//
// PER Plan 03-06 note (modal-style presentation):
//   The Tabs.Screen registration in app/(app)/_layout.tsx only carries
//   `href: null` — the Tabs navigator type rejects `presentation`,
//   `animation`, and `gestureEnabled`. This file owns its own <Stack> wrapper
//   that applies those modal-style options.

import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraView as CameraViewType,
} from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useGroup } from '../../../src/features/groups/useGroup';
import { useSubmitToday } from '../../../src/features/submissions/useSubmitToday';
import {
  Shutter,
  CaptureTopBar,
  ReviewPanel,
  Modal,
  PrimaryButton,
  GhostButton,
  ScreenContainer,
} from '../../../src/components';
import { useTheme } from '../../../src/theme/useTheme';

export default function CaptureScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  // ── Hook calls (UNCONDITIONAL — Rules of Hooks per REVIEWS.md C6) ──────
  const { data: group, isPending: groupPending } = useGroup(groupId);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const submitMutation = useSubmitToday();

  const cameraRef = useRef<CameraViewType | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingStartIso, setRecordingStartIso] = useState<string | null>(
    null,
  );
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [caption, setCaption] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [muted, setMuted] = useState(true);

  // PER REVIEWS.md C6 — useVideoPlayer is UNCONDITIONAL at the top of the
  // component, alongside other hooks. Empty/null source → idle player; the
  // conditional render of <VideoView> in the review state branch does NOT
  // change the hook call site.
  //
  // The setup callback only runs ONCE with the initial source (empty string).
  // When mediaUri later transitions to a real video URI, expo-video updates
  // the player's source but does NOT replay the setup callback. The effect
  // below re-asserts loop/muted and calls play() so the preview actually
  // loops instead of frozen on first frame.
  const videoPlayer = useVideoPlayer(mediaUri ?? '', (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (!mediaUri) return;
    videoPlayer.muted = muted;
    videoPlayer.loop = true;
    videoPlayer.play();
  }, [mediaUri, videoPlayer, muted]);

  const isVideoGroup = group?.submission_type === 'video';

  // ── Permission gate (UI-SPEC line 788-792) ─────────────────────────────
  // Request camera permission on mount when not yet granted.
  useEffect(() => {
    if (camPerm && !camPerm.granted && camPerm.canAskAgain !== false) {
      void requestCamPerm();
    }
  }, [camPerm, requestCamPerm]);

  // For video groups: request mic AFTER camera grants.
  useEffect(() => {
    if (
      isVideoGroup &&
      camPerm?.granted &&
      micPerm &&
      !micPerm.granted &&
      micPerm.canAskAgain !== false
    ) {
      void requestMicPerm();
    }
  }, [isVideoGroup, camPerm, micPerm, requestMicPerm]);

  // PER Pitfall 5 — re-poll permission state when the user returns from OS
  // Settings. Without this the user is stuck on the deny screen after granting.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (camPerm?.status === 'denied' && camPerm.canAskAgain !== false) {
        void requestCamPerm();
      }
      if (
        isVideoGroup &&
        micPerm?.status === 'denied' &&
        micPerm.canAskAgain !== false
      ) {
        void requestMicPerm();
      }
    });
    return () => sub.remove();
  }, [camPerm, micPerm, isVideoGroup, requestCamPerm, requestMicPerm]);

  // ── Stack-modal options removed (Phase 3 inline UAT fix) ──────────────
  // The capture route is registered as a Tabs.Screen (not a Stack.Screen) in
  // app/(app)/_layout.tsx. `<Stack.Screen options={{ animation:
  // 'slide_from_bottom', ... }}>` declared here was leaking those Stack-only
  // options into the Tabs navigator's options bag, which crashed the bottom-
  // tabs v7 animation registry (`sceneStyleInterpolator` undefined) on every
  // navigation to /capture/[groupId].
  //
  // Restoring proper modal-style presentation (slide-from-bottom + gesture
  // disabled) requires moving the capture route OUT of the Tabs and into the
  // root Stack — tracked as a Phase 3.1 / 03-08 gap-closure item, not a
  // blocking regression.
  const stackScreen: React.ReactNode = null;

  // Safe-back: capture/[groupId] is a Tabs.Screen with no Stack history above
  // it (modal-presentation deferred to Phase 3.1). dismissCapture() fires a POP
  // action that React Navigation can't resolve, surfacing a dev warning toast.
  // Fall back to an explicit replace to Today when there's no history to pop.
  const dismissCapture = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/');
    }
  };

  // ── Loading / 404 group guard ──────────────────────────────────────────
  if (groupPending || !group) {
    return (
      <>
        {stackScreen}
        <ScreenContainer>
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={t.colors.text} />
          </View>
        </ScreenContainer>
      </>
    );
  }

  // ── Permission-denied: camera ──────────────────────────────────────────
  if (camPerm && !camPerm.granted) {
    return (
      <>
        {stackScreen}
        <PermissionDeniedScreen
          icon="camera"
          title="We need camera access"
          body="Tap below to grant access in Settings, then come back."
          onClose={() => dismissCapture()}
        />
      </>
    );
  }

  // ── Permission-denied: microphone (video groups only) ──────────────────
  if (isVideoGroup && micPerm && !micPerm.granted) {
    return (
      <>
        {stackScreen}
        <PermissionDeniedScreen
          icon="mic"
          title="We need mic access too"
          body="Videos record audio — flip on mic access in Settings to keep going."
          onClose={() => dismissCapture()}
        />
      </>
    );
  }

  // ── Submit handler (UI-SPEC §Submit flow error copy lines 388-397) ─────
  const handleSubmit = async () => {
    if (!mediaUri) return;
    setErrorText(null);
    try {
      await submitMutation.mutateAsync({
        groupId,
        mediaLocalUri: mediaUri,
        mediaType: group.submission_type,
        caption: caption.length > 0 ? caption : null,
      });
      // PER REVIEWS.md C7: success haptic ONLY fires after the mutation
      // resolves successfully. Wrapped in try/catch (P2 Shared Pattern 7 —
      // silent fail on unsupported devices).
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      dismissCapture();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      // UAT diagnostic: surface the raw error to Metro so we can see what's
      // actually being thrown (storage 4xx/5xx, RLS denial, RPC code, etc.).
      // Remove this console.error after Phase 3 closes.
      console.error('[capture submit failed]', { msg, err });
      // 'queued' marker → network error; entry already enqueued by
      // useSubmitToday + ['uploadQueue'] cache invalidated. Dismiss to Today;
      // QueueBadge takes over (UI-SPEC line 826). NO haptic — the dismissal
      // is the feedback.
      if (msg === 'queued') {
        dismissCapture();
        return;
      }
      // Map typed errors to UI-SPEC §Submit flow error copy (lines 388-397).
      // No haptic on typed-error path either.
      const groupKind = group.submission_type;
      const otherKind = groupKind === 'photo' ? 'video' : 'photo';
      switch (msg) {
        case 'not_member':
          setErrorText("You're not in this group anymore.");
          break;
        case 'wrong_media_type':
        case 'invalid_media_type':
          setErrorText(
            `This group expects a ${groupKind}, not a ${otherKind}.`,
          );
          break;
        case 'already_submitted_today':
          setErrorText(
            "You already submitted today. Streak's safe — see you tomorrow.",
          );
          break;
        case 'caption_too_long':
          setErrorText('Keep it short — 140 characters max.');
          break;
        case 'not_authenticated':
          setErrorText('Your session expired — sign back in and retry.');
          break;
        case 'uuid_unavailable':
          setErrorText('Internal: UUID API missing. Reload and retry.');
          break;
        default:
          // UAT diagnostic mode: show the raw message so we can identify
          // unmapped errors quickly. Revert to the friendly copy after we
          // identify all the real-world error shapes.
          setErrorText(`Submit failed: ${msg || '(no error message)'}`);
      }
    }
  };

  const handleClose = () => {
    if (mediaUri) {
      setShowDiscard(true);
    } else {
      dismissCapture();
    }
  };

  const onPhotoShutter = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (photo?.uri) setMediaUri(photo.uri);
    } catch {
      // Silent fail — user can press shutter again.
    }
  };

  const onVideoShutter = async () => {
    if (recording) {
      cameraRef.current?.stopRecording();
      return;
    }
    setRecording(true);
    setRecordingStartIso(new Date().toISOString());
    try {
      const video = await cameraRef.current?.recordAsync({
        maxDuration: 10,
      });
      if (video?.uri) setMediaUri(video.uri);
    } catch {
      // ignore
    } finally {
      setRecording(false);
      setRecordingStartIso(null);
    }
  };

  // ── Review state (UI-SPEC line 810) ────────────────────────────────────
  if (mediaUri && !recording) {
    const isPhoto = group.submission_type === 'photo';
    return (
      <>
        {stackScreen}
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          {isPhoto ? (
            <Image
              source={{ uri: mediaUri }}
              style={{ flex: 1 }}
              contentFit="cover"
              accessibilityLabel="Your captured photo"
            />
          ) : (
            <VideoView
              player={videoPlayer}
              style={{ flex: 1 }}
              nativeControls={false}
              contentFit="cover"
              accessibilityLabel="Your captured video, looping muted"
            />
          )}

          <CaptureTopBar
            groupName={group.name}
            onClose={handleClose}
            showFlipCamera={false}
          />

          {/* Video review: Looping pill + mute toggle (UI-SPEC line 810-815) */}
          {!isPhoto ? (
            <>
              <View
                style={{
                  position: 'absolute',
                  top: insets.top + 56,
                  left: t.spacing.lg,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: t.spacing.md,
                    paddingVertical: t.spacing.xs,
                    borderRadius: t.radii.pill,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <Text
                    style={[
                      t.fonts.caption,
                      { color: '#FFFFFF', fontWeight: '500' },
                    ]}
                  >
                    Looping
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  muted ? 'Unmute video preview' : 'Mute video preview'
                }
                hitSlop={8}
                onPress={() => {
                  const next = !muted;
                  setMuted(next);
                  videoPlayer.muted = next;
                }}
                style={{
                  position: 'absolute',
                  top: insets.top + 56,
                  right: t.spacing.lg,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather
                  name={muted ? 'volume-x' : 'volume-2'}
                  size={18}
                  color="#FFFFFF"
                />
              </Pressable>
            </>
          ) : null}

          <ReviewPanel
            mediaType={group.submission_type}
            caption={caption}
            onCaptionChange={setCaption}
            onRetake={() => {
              setMediaUri(null);
              setErrorText(null);
            }}
            onSubmit={handleSubmit}
            loading={submitMutation.isPending}
            errorText={errorText}
          />

          {/* Discard-take Modal (UI-SPEC line 830) */}
          <Modal
            visible={showDiscard}
            onDismiss={() => setShowDiscard(false)}
            title="Discard this take?"
            body="You'll lose what you just recorded."
            primaryAction={{
              label: 'Discard',
              variant: 'destructive',
              onPress: () => {
                setShowDiscard(false);
                setMediaUri(null);
                dismissCapture();
              },
            }}
            // PER UI-SPEC §Discard-take + Modal dev-warning: must NOT be 'Cancel'.
            cancelLabel="Keep recording"
          />
        </View>
      </>
    );
  }

  // ── Capture state (viewfinder) ─────────────────────────────────────────
  return (
    <>
      {stackScreen}
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
          mode={isVideoGroup ? 'video' : 'picture'}
          accessibilityLabel="Camera viewfinder"
        />

        <CaptureTopBar
          groupName={group.name}
          onClose={handleClose}
          showFlipCamera={isVideoGroup}
          onFlip={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        />

        {/* REC pill — top-center while recording (UI-SPEC line 1004) */}
        {recording ? (
          <View
            style={{
              position: 'absolute',
              top: insets.top + t.spacing.md + 4,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
            pointerEvents="none"
          >
            <View
              style={{
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.xs,
                borderRadius: t.radii.pill,
                backgroundColor: t.colors.destructive,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#FFFFFF',
                }}
              />
              <Text
                style={[
                  t.fonts.caption,
                  { color: '#FFFFFF', fontWeight: '700' }
                ]}
                allowFontScaling={false}
              >
                REC
              </Text>
            </View>
          </View>
        ) : null}

        {/* Bottom panel: progress bar (video) + Shutter + hint */}
        <View
          style={{
            position: 'absolute',
            bottom: Math.max(insets.bottom, t.spacing.lg),
            left: 0,
            right: 0,
            alignItems: 'center',
            gap: t.spacing.md,
          }}
        >
          {isVideoGroup ? (
            <RecordingProgressBar
              startedIso={recordingStartIso}
              recording={recording}
            />
          ) : null}
          <Shutter
            variant={
              isVideoGroup
                ? recording
                  ? 'video-recording'
                  : 'video-idle'
                : 'photo'
            }
            onPress={isVideoGroup ? onVideoShutter : onPhotoShutter}
          />
          {isVideoGroup && !recording ? (
            <Text
              style={[
                t.fonts.caption,
                { color: '#FFFFFF', fontWeight: '500' }
              ]}
              allowFontScaling={false}
            >
              Tap to start · 10 seconds max
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );
}

// ── PermissionDeniedScreen — shared shape for camera + mic denial ───────
function PermissionDeniedScreen({
  icon,
  title,
  body,
  onClose,
}: {
  icon: 'camera' | 'mic';
  title: string;
  body: string;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <ScreenContainer>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: t.spacing.xl,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: `${t.colors.primary}40`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={icon} size={32} color={t.colors.text} />
        </View>
        <Text
          accessibilityRole="header"
          style={[
            t.fonts.heading1,
            {
              color: t.colors.textStrong,
              textAlign: 'center',
              marginTop: t.spacing.xl,
            },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            t.fonts.body,
            {
              color: t.colors.textMuted,
              textAlign: 'center',
              marginTop: t.spacing.md,
              maxWidth: 280,
            },
          ]}
        >
          {body}
        </Text>
        <View
          style={{
            marginTop: t.spacing['2xl'],
            width: '100%',
            maxWidth: 320,
            gap: t.spacing.md,
          }}
        >
          <PrimaryButton
            label="Open Settings"
            onPress={() => {
              void Linking.openSettings();
            }}
          />
          <GhostButton label="Not now" onPress={onClose} />
        </View>
      </View>
    </ScreenContainer>
  );
}

// ── RecordingProgressBar — inline (UI-SPEC §Lovable mock mapping line 358)
function RecordingProgressBar({
  startedIso,
  recording,
}: {
  startedIso: string | null;
  recording: boolean;
}) {
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedIso) return;
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, [startedIso]);

  const elapsed = startedIso
    ? Math.min(10, (now - Date.parse(startedIso)) / 1000)
    : 0;
  const remaining = Math.max(0, Math.ceil(10 - elapsed));
  const progress = elapsed / 10;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingHorizontal: t.spacing.xl,
        width: '100%',
      }}
    >
      <View
        style={{
          flex: 1,
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: t.colors.primary,
          }}
        />
      </View>
      <Text
        allowFontScaling={false}
        style={[
          t.fonts.caption,
          {
            color: '#FFFFFF',
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          },
        ]}
        accessibilityLabel={
          recording ? `Recording, ${remaining} seconds left` : `0 of 10 seconds`
        }
        accessibilityLiveRegion="polite"
      >
        {`0:${String(remaining).padStart(2, '0')}`}
      </Text>
    </View>
  );
}
