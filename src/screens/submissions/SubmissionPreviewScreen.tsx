/**
 * SubmissionPreviewScreen.tsx
 * Shows the captured photo or video before uploading. The user can retake
 * or confirm submission. The "Submit" button is a placeholder wired up
 * in Phase 6 when the upload pipeline exists.
 * SCRUM-20, 21, 22.
 */

import React, { useEffect, useRef } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { useSubmission } from '@/hooks/useSubmission'
import UploadProgressBar from '@/components/submissions/UploadProgressBar'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'SubmissionPreview'>
  route: RouteProp<HomeStackParamList, 'SubmissionPreview'>
}

export default function SubmissionPreviewScreen({ navigation, route }: Props) {
  const { groupId, localUri, mediaType } = route.params
  const { submit, isUploading, uploadProgress, error } = useSubmission()
  const isVideo = mediaType === 'video'

  // expo-av v16 uses useVideoPlayer hook + VideoView component (not legacy Video).
  const player = useVideoPlayer(isVideo ? localUri : null, p => {
    p.loop = true
    p.play()
  })

  async function handleSubmit() {
    try {
      await submit({ localUri, mediaType, groupId })
      navigation.navigate('GroupDetail', { groupId })
    } catch {
      // error state set in useSubmission — displayed below
    }
  }

  return (
    <View style={styles.container}>
      {/* Media preview */}
      <View style={styles.mediaContainer}>
        {isVideo ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <Image source={{ uri: localUri }} style={styles.media} resizeMode="contain" />
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {isUploading && <UploadProgressBar progress={uploadProgress} />}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.retakeBtn} onPress={() => navigation.goBack()} disabled={isUploading}>
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, isUploading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={isUploading}>
            <Text style={styles.submitBtnText}>{isUploading ? 'Uploading…' : 'Submit proof'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mediaContainer: { flex: 1 },
  media: { flex: 1, width: '100%' },
  actions: {
    padding: 24, gap: 12,
    backgroundColor: COLORS.bgPrimary,
  },
  buttons: { flexDirection: 'row', gap: 12 },
  errorText: { fontSize: 13, color: COLORS.error, textAlign: 'center' },
  retakeBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 16, alignItems: 'center',
  },
  retakeBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 16 },
  submitBtn: {
    flex: 2, backgroundColor: COLORS.success,
    borderRadius: 10, padding: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
})
