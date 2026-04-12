/**
 * CameraScreen.tsx
 * Handles both video recording (SCRUM-20) and photo capture (SCRUM-22) via
 * a single screen. The `mode` route param determines which CameraView mode
 * is active. Never toggle modes after mount — set at render time only.
 */

import React, { useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import * as FileSystem from 'expo-file-system/legacy'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { HomeStackParamList } from '@/types/navigation'
import { requestCameraAndMicPermissions } from '@/utils/permissions'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'Camera'>
  route: RouteProp<HomeStackParamList, 'Camera'>
}

const MAX_VIDEO_DURATION_MS = 60_000 // 60 seconds

export default function CameraScreen({ navigation, route }: Props) {
  const { groupId, mode } = route.params
  const isVideo = mode === 'video'

  const cameraRef = useRef<CameraView>(null)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [micPermission, requestMicPermission] = useMicrophonePermissions()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Show permission request screen if not yet granted.
  if (!cameraPermission?.granted || (isVideo && !micPermission?.granted)) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          {isVideo
            ? 'Camera and microphone access are needed to record video.'
            : 'Camera access is needed to take photos.'}
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => requestCameraAndMicPermissions(requestCameraPermission, requestMicPermission)}
        >
          <Text style={styles.permissionBtnText}>Grant access</Text>
        </TouchableOpacity>
      </View>
    )
  }

  async function handleRecord() {
    if (!cameraRef.current || isRecording) return
    setIsRecording(true)
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 })
      if (!result?.uri) return
      await navigateToPreview(result.uri, 'video')
    } catch (e) {
      Alert.alert('Error', 'Recording failed. Please try again.')
    } finally {
      setIsRecording(false)
    }
  }

  function handleStopRecording() {
    cameraRef.current?.stopRecording()
  }

  async function handleTakePhoto() {
    if (!cameraRef.current || isProcessing) return
    setIsProcessing(true)
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      if (!result?.uri) return
      await navigateToPreview(result.uri, 'photo')
    } finally {
      setIsProcessing(false)
    }
  }

  // Copy the temp URI to documentDirectory before navigating — camera cache
  // can be cleared while the user is on the preview screen.
  async function navigateToPreview(tempUri: string, mediaType: 'photo' | 'video') {
    const ext = mediaType === 'video' ? 'mp4' : 'jpg'
    const dest = FileSystem.documentDirectory + `capture_${Date.now()}.${ext}`
    try {
      await FileSystem.copyAsync({ from: tempUri, to: dest })
      navigation.navigate('SubmissionPreview', { groupId, localUri: dest, mediaType })
    } catch {
      Alert.alert('Error', 'Could not save capture. Please try again.')
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        mode={mode === 'video' ? 'video' : 'picture'}
        facing="back"
      />

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.controls}>
        {isVideo ? (
          // Video: tap to start, tap again to stop.
          <TouchableOpacity
            style={[styles.captureBtn, isRecording && styles.captureBtnRecording]}
            onPress={isRecording ? handleStopRecording : handleRecord}
          >
            <View style={isRecording ? styles.stopIcon : styles.recordIcon} />
          </TouchableOpacity>
        ) : (
          // Photo: single tap to capture.
          <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto} disabled={isProcessing}>
            {isProcessing
              ? <ActivityIndicator color="#000" />
              : <View style={styles.recordIcon} />
            }
          </TouchableOpacity>
        )}

        {isRecording && (
          <Text style={styles.recordingLabel}>Recording — tap to stop</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  backBtn: { position: 'absolute', top: 52, left: 20, zIndex: 10, padding: 8 },
  backBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  controls: { position: 'absolute', bottom: 48, width: '100%', alignItems: 'center' },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)',
  },
  captureBtnRecording: { backgroundColor: COLORS.error },
  recordIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.error },
  stopIcon: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#fff' },
  recordingLabel: { color: '#fff', marginTop: 12, fontSize: 14 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: COLORS.bgPrimary },
  permissionText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  permissionBtn: { backgroundColor: COLORS.success, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28 },
  permissionBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
})
