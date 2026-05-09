// MediaViewer — fullscreen Modal viewer for FeedItem media (UI-SPEC line 546,
// CONTEXT D-11). Opens when a feed item's 80×80 thumbnail is tapped.
//
// HIGH #11 cascade (REVIEWS replan 2026-05-08): consumes the shared
//   useSignedMediaUrl from src/hooks/useSignedMediaUrl (NOT inline). FeedItem
//   also consumes the shared hook — both are spy-able in tests via
//   jest.spyOn(useSignedMediaUrlModule, 'useSignedMediaUrl').
//
// MEDIUM useVideoPlayer (REVIEWS replan 2026-05-08): useVideoPlayer is called
//   inside a conditional child component <VideoMediaView> that is rendered
//   only when mediaType === 'video' AND signedUrl is present. This avoids
//   the empty-source problem (expo-video warns when constructed with '')
//   and keeps Rules of Hooks correct (the hook always runs in the child
//   component's lifecycle).
//
// Hardcoded colors `'black'`, `'white'`, `'rgba(0,0,0,0.55)'` are intentional
// — media-over-content surface, not theme-driven (UI-SPEC line 223 precedent).

import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSignedMediaUrl } from '../hooks/useSignedMediaUrl';

export interface MediaViewerProps {
  /** Storage path in the private 'submissions' bucket; resolved via signed URL. */
  mediaPath: string;
  mediaType: 'photo' | 'video';
  onClose: () => void;
}

// MEDIUM useVideoPlayer (RESOLVED via REVIEWS replan 2026-05-08):
// the hook lives inside this child component, which is rendered only when
// video + signedUrl present. Inside the child, useVideoPlayer is always
// called (Rules of Hooks preserved); the parent's conditional render avoids
// constructing the player with an empty source.
function VideoMediaView({ signedUrl }: { signedUrl: string }) {
  const player = useVideoPlayer(signedUrl, (p) => {
    p.muted = false;
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      nativeControls={true}
      contentFit="contain"
      // Note: fullscreen toggling is wired through the native controls UI.
      // The expo-video prop name in SDK 55 is `fullscreenOptions` (an
      // object), not the legacy `allowsFullscreen` boolean — leaving the
      // default since the user is already in our custom fullscreen Modal.
    />
  );
}

export function MediaViewer({
  mediaPath,
  mediaType,
  onClose,
}: MediaViewerProps) {
  const { data: signedUrl, isPending } = useSignedMediaUrl(mediaPath);

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isPending || !signedUrl ? (
          <ActivityIndicator color="white" />
        ) : mediaType === 'photo' ? (
          <Image
            source={{ uri: signedUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            accessibilityLabel="Submitted photo"
          />
        ) : (
          <VideoMediaView signedUrl={signedUrl} />
        )}

        {/* Top-right close button — 44×44 hit target over a translucent disk */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => ({
            position: 'absolute',
            top: 56,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: 'white',
              fontSize: 20,
              fontWeight: '700',
              lineHeight: 22,
            }}
          >
            ✕
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
