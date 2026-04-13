/**
 * VideoPlayer.tsx
 * Thin wrapper around expo-av v16's VideoView + useVideoPlayer hook.
 * Auto-plays and loops. Used in submission preview and admin review detail.
 */

import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

type Props = {
  uri: string
  style?: StyleProp<ViewStyle>
}

export default function VideoPlayer({ uri, style }: Props) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true
    p.play()
  })

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      contentFit="contain"
      nativeControls={false}
    />
  )
}

const styles = StyleSheet.create({
  video: { width: '100%', flex: 1 },
})
