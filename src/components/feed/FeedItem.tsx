// FeedItem — feed card with avatar + name + relative time + 80×80 media thumb
// + optional 2-line caption.
// Spec: 04-UI-SPEC.md §"Component Additions §2 FeedItem" (lines 507-555)
//       + Copywriting Contract "Today's posts (FEED-01)" (lines 328-343).
//
// HIGH #11 (REVIEWS replan 2026-05-08): consumes shared useSignedMediaUrl
// from ../../hooks/useSignedMediaUrl so jest.spyOn works in tests.
//
// MEDIUM RN role: accessibilityRole='text' on the outer card (NOT 'summary',
// which is iOS-only and not consistently supported in RN).
//
// MEDIUM useVideoPlayer: useVideoPlayer must NOT be called with empty source.
// The hook is hoisted into a child component <FeedVideoThumb> rendered only
// when mediaType === 'video' AND signedUrl exists. Rules of Hooks preserved
// because FeedVideoThumb always calls useVideoPlayer in its own scope.

import { Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Avatar } from '../Avatar';
import { useTheme, type Theme } from '../../theme/useTheme';
import { useSignedMediaUrl } from '../../hooks/useSignedMediaUrl';
import { submittedAgoLabel } from '../../features/submissions/time';

export interface FeedItemProps {
  submissionId: string;
  submitterUserId: string;
  /** Caller pre-computes via `entry.user_id === auth.user.id`. */
  isYou: boolean;
  displayName: string;
  /** Resolved public URL (with WR-01 ?v={updated_at} cache-bust). */
  avatarUrl?: string | null;
  /** Signed-url-resolvable storage path (private 'submissions' bucket). */
  mediaPath: string;
  mediaType: 'photo' | 'video';
  caption?: string | null;
  /** ISO timestamp; component formats relative ("3m ago"). */
  submittedAt: string;
  onMediaPress: () => void;
}

interface FeedVideoThumbProps {
  signedUrl: string;
  t: Theme;
}

function FeedVideoThumb({ signedUrl, t }: FeedVideoThumbProps) {
  // Autoplay-muted-loop video at thumbnail size (UI-SPEC line 540-541).
  const player = useVideoPlayer(signedUrl, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{
        width: 80,
        height: 80,
        borderRadius: t.radii.md,
      }}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

function compositeA11yLabel(args: {
  displayName: string;
  isYou: boolean;
  ago: string;
  caption?: string | null;
}): string {
  const youSuffix = args.isYou ? ' (you)' : '';
  const captionPart = args.caption ? `, caption: ${args.caption}` : ', no caption';
  return `Post from ${args.displayName}${youSuffix}, submitted ${args.ago}${captionPart}`;
}

export function FeedItem({
  submissionId: _submissionId,
  submitterUserId: _submitterUserId,
  isYou,
  displayName,
  avatarUrl,
  mediaPath,
  mediaType,
  caption,
  submittedAt,
  onMediaPress,
}: FeedItemProps) {
  const t = useTheme();
  const { data: signedUrl } = useSignedMediaUrl(mediaPath);
  const ago = submittedAgoLabel(submittedAt) ?? '';

  return (
    <View
      // MEDIUM RN role: 'text' (not 'summary') — UI-SPEC + REVIEWS replan 2026-05-08.
      accessibilityRole="text"
      accessibilityLabel={compositeA11yLabel({
        displayName,
        isYou,
        ago,
        caption,
      })}
      style={{
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        padding: t.spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: t.spacing.md,
      }}
    >
      {/* Avatar (48pt) */}
      <Avatar size={48} name={displayName} imageUri={avatarUrl ?? null} />

      {/* Middle column: name + relative time + optional caption */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={[
              t.fonts.body,
              { color: t.colors.text, fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {isYou ? (
            <Text
              style={[
                t.fonts.body,
                {
                  color: t.colors.textMuted,
                  fontWeight: '500',
                  marginLeft: t.spacing.xs,
                },
              ]}
            >
              (you)
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            t.fonts.caption,
            {
              color: t.colors.textMuted,
              fontWeight: '500',
              marginTop: 2,
            },
          ]}
        >
          {ago}
        </Text>
        {caption ? (
          <Text
            style={[
              t.fonts.body,
              {
                color: t.colors.text,
                fontWeight: '500',
                marginTop: t.spacing.xs,
              },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {caption}
          </Text>
        ) : null}
      </View>

      {/* Thumbnail Pressable (80×80) — own focus stop with explicit "Open ..." label */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${mediaType}`}
        accessibilityHint={`Shows the full ${mediaType}`}
        onPress={onMediaPress}
        style={({ pressed }) => ({
          width: 80,
          height: 80,
          borderRadius: t.radii.md,
          overflow: 'hidden',
          backgroundColor: t.colors.surfaceMuted,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        {mediaType === 'photo' ? (
          signedUrl ? (
            <Image
              source={{ uri: signedUrl }}
              style={{ width: 80, height: 80 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 80, height: 80 }} />
          )
        ) : signedUrl ? (
          // MEDIUM useVideoPlayer (REVIEWS replan 2026-05-08): conditional child
          // so useVideoPlayer is never called with empty source.
          <FeedVideoThumb signedUrl={signedUrl} t={t} />
        ) : (
          // Loading state — keeps the slot height stable.
          <View style={{ width: 80, height: 80 }} />
        )}

        {/* Video play badge — only when mediaType === 'video' */}
        {mediaType === 'video' ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: 20,
              height: 20,
              borderRadius: 10,
              // Hardcoded over user media per UI-SPEC line 223.
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="play" size={10} color="white" />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
