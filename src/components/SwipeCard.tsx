// SwipeCard — admin queue media card with gesture-bindable transforms.
// Spec: 03-UI-SPEC.md §5 SwipeCard (lines 552-612).
// Per RESEARCH §Pattern 4: parent (Plan 03-07 review screen) owns the
// PanGestureHandler and passes translateX/rotate/opacity SharedValues plus
// scale/translateY/zIndex static props down. SwipeCard applies them via
// useAnimatedStyle.
//
// Per REVIEWS.md C5 (Approach A): props match the PendingSubmissionRow shape
// from Plan 03-05's useReviewQueue (snake_case) so the review screen can
// spread the row directly without a mapper.

import { Image, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/useTheme';
import { supabase } from '../lib/supabase';
import { submittedAgoLabel } from '../features/submissions/time';

export interface SwipeCardProps {
  // Row-shaped fields — match PendingSubmissionRow (Plan 03-05).
  display_name: string | null;
  avatar_path: string | null;
  updated_at?: string | null;
  created_at: string;
  caption?: string | null;
  media_path: string;
  media_type: 'photo' | 'video';
  // Gesture-controlled (parent owns the PanGestureHandler — Plan 03-07).
  translateX?: SharedValue<number>;
  rotate?: SharedValue<number>;
  opacity?: SharedValue<number>;
  zIndex?: number;
  scale?: number;
  translateY?: number;
  overlay?: 'approve' | 'reject' | null;
}

function useSignedMediaUrl(path: string) {
  return useQuery({
    queryKey: ['signedUrl', path],
    // < 60s TTL forces a refresh before the URL expires.
    staleTime: 50_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('submissions')
        .createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function SwipeCard({
  display_name,
  avatar_path,
  updated_at,
  created_at,
  caption,
  media_path,
  media_type,
  translateX,
  rotate,
  opacity,
  zIndex,
  scale = 1,
  translateY = 0,
  overlay,
}: SwipeCardProps) {
  const t = useTheme();
  const submitterName = display_name ?? 'Member';
  const ago = submittedAgoLabel(created_at) ?? '';
  const { data: signedUrl } = useSignedMediaUrl(media_path);

  // Gesture-driven animated style. When the parent doesn't pass SharedValues
  // (e.g. for next-card / next-next-card stack positions), .value reads
  // resolve to undefined and we fall back to identity.
  const animatedStyle = useAnimatedStyle(() => {
    const tx = translateX?.value ?? 0;
    const rot = rotate?.value ?? 0;
    const op = opacity?.value ?? 1;
    return {
      transform: [
        { translateX: tx },
        { translateY: translateY },
        { scale: scale },
        { rotate: `${rot}deg` },
      ],
      opacity: op,
    };
  });

  // Autoplay-muted-loop video per UI-SPEC line 599-601. useVideoPlayer must be
  // called unconditionally (Rules of Hooks); pass empty string when not in
  // video mode — expo-video idles.
  const player = useVideoPlayer(
    media_type === 'video' && signedUrl ? signedUrl : '',
    (p) => {
      p.muted = true;
      p.loop = true;
      p.play();
    },
  );

  const a11yLabel = `Submission from ${submitterName}, ${ago}${
    caption ? `, caption: ${caption}` : ''
  }`;

  // Avatar URL — uses the ?v=${updated_at} cache-bust idiom (WR-01 pattern).
  // Note: avatar_path is the storage path; consumer (Plan 03-05/03-06) is
  // responsible for resolving it to a public URL before/inside SwipeCard.
  // For now, pass through the path with the cache-bust suffix appended.
  const avatarUri = avatar_path
    ? `${avatar_path}${updated_at ? `?v=${encodeURIComponent(updated_at)}` : ''}`
    : null;

  return (
    <Animated.View
      accessibilityRole={media_type === 'photo' ? 'image' : 'none'}
      accessibilityLabel={a11yLabel}
      accessibilityActions={[
        { name: 'approve', label: 'Approve' },
        { name: 'reject', label: 'Reject' },
      ]}
      style={[
        {
          position: 'absolute',
          left: '4%',
          right: '4%',
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.lg,
          padding: t.spacing.lg,
          zIndex,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 8,
        },
        animatedStyle,
      ]}
    >
      {/* ROW 1: avatar + submitter name + relative timestamp */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          marginBottom: t.spacing.md,
        }}
      >
        <Avatar size={40} name={submitterName} imageUri={avatarUri} />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              t.fonts.body,
              { fontWeight: '700', color: t.colors.text },
            ]}
            numberOfLines={1}
          >
            {submitterName}
          </Text>
          <Text
            style={[
              t.fonts.caption,
              { color: t.colors.textMuted, fontWeight: '500' },
            ]}
          >
            {`submitted ${ago}`}
          </Text>
        </View>
      </View>

      {/* ROW 2: media frame (clipped, md radius) */}
      <View
        style={{
          borderRadius: t.radii.md,
          overflow: 'hidden',
          aspectRatio: media_type === 'photo' ? 4 / 3 : 16 / 9,
          backgroundColor: t.colors.surfaceMuted,
        }}
      >
        {media_type === 'photo' && signedUrl ? (
          <Image
            source={{ uri: signedUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityLabel="Submitted photo"
          />
        ) : null}
        {media_type === 'video' && signedUrl ? (
          <VideoView
            player={player}
            style={{ width: '100%', height: '100%' }}
            nativeControls={false}
            contentFit="cover"
          />
        ) : null}
      </View>

      {/* ROW 3: caption — italic, 3-line truncate, only when non-empty */}
      {caption && caption.length > 0 ? (
        <Text
          style={[
            t.fonts.body,
            {
              color: t.colors.text,
              fontWeight: '500',
              fontStyle: 'italic',
              marginTop: t.spacing.md,
            },
          ]}
          numberOfLines={3}
        >
          {`"${caption}"`}
        </Text>
      ) : null}

      {/* OVERLAY decoration — non-interactive */}
      {overlay === 'approve' ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: 'absolute',
            right: 24,
            top: '40%',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: t.colors.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="check" size={42} color={t.colors.primaryFg} />
        </View>
      ) : null}
      {overlay === 'reject' ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: 'absolute',
            left: 24,
            top: '40%',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: t.colors.destructive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="x" size={42} color="#FFFFFF" />
        </View>
      ) : null}
    </Animated.View>
  );
}
