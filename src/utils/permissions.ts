/**
 * permissions.ts
 * Centralised permission request helpers. All screens that need camera,
 * microphone, or media library access call these functions instead of
 * duplicating the permission logic inline.
 */

import { Alert } from 'react-native'
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'

/**
 * requestCameraAndMicPermissions
 * Requests camera + microphone permissions required for video recording.
 * Shows a user-friendly alert if denied. Returns true if both are granted.
 */
export async function requestCameraAndMicPermissions(
  requestCamera: () => Promise<{ granted: boolean }>,
  requestMic: () => Promise<{ granted: boolean }>
): Promise<boolean> {
  const [camResult, micResult] = await Promise.all([requestCamera(), requestMic()])
  if (!camResult.granted || !micResult.granted) {
    Alert.alert(
      'Camera & microphone needed',
      'Please allow camera and microphone access in your device settings to record video.',
      [{ text: 'OK' }]
    )
    return false
  }
  return true
}

/**
 * requestGalleryPermission
 * Requests media library read access for gallery picking.
 * Returns true if granted.
 */
export async function requestGalleryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert(
      'Gallery access needed',
      'Please allow photo library access in your device settings.',
      [{ text: 'OK' }]
    )
    return false
  }
  return true
}
