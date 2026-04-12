/**
 * SubmitChoiceScreen.tsx
 * Entry point for the proof submission flow. The user picks how they want
 * to submit: record a video, take a photo, or pick from the gallery.
 * Gallery picking happens inline here (no separate route needed).
 * SCRUM-20, 21, 22.
 */

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { HomeStackParamList } from '@/types/navigation'
import { requestGalleryPermission } from '@/utils/permissions'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'SubmitChoice'>
  route: RouteProp<HomeStackParamList, 'SubmitChoice'>
}

const MAX_GALLERY_DURATION_MS = 120_000

export default function SubmitChoiceScreen({ navigation, route }: Props) {
  const { groupId } = route.params
  const [isPickingGallery, setIsPickingGallery] = useState(false)

  async function handleGalleryPick() {
    const granted = await requestGalleryPermission()
    if (!granted) return

    setIsPickingGallery(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 1,
        videoMaxDuration: 120,
      })

      if (result.canceled || result.assets.length === 0) return
      const asset = result.assets[0]

      // asset.duration is in ms — enforce 2-minute limit.
      if (asset.type === 'video' && asset.duration && asset.duration > MAX_GALLERY_DURATION_MS) {
        Alert.alert('Video too long', 'Please choose a video under 2 minutes.')
        return
      }

      // Copy from picker cache to persistent storage before navigating.
      const ext = asset.type === 'video' ? 'mp4' : 'jpg'
      const dest = FileSystem.documentDirectory + `pick_${Date.now()}.${ext}`
      await FileSystem.copyAsync({ from: asset.uri, to: dest })

      const mediaType = asset.type === 'video' ? 'video' : 'photo'
      navigation.navigate('SubmissionPreview', { groupId, localUri: dest, mediaType })
    } finally {
      setIsPickingGallery(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit proof</Text>
      <Text style={styles.subtitle}>How do you want to submit today?</Text>

      <TouchableOpacity
        style={styles.option}
        onPress={() => navigation.navigate('Camera', { groupId, mode: 'video' })}
      >
        <Text style={styles.optionIcon}>🎥</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Record video</Text>
          <Text style={styles.optionDesc}>Up to 60 seconds</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.option}
        onPress={() => navigation.navigate('Camera', { groupId, mode: 'photo' })}
      >
        <Text style={styles.optionIcon}>📸</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Take a photo</Text>
          <Text style={styles.optionDesc}>Single snapshot</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={handleGalleryPick} disabled={isPickingGallery}>
        {isPickingGallery
          ? <ActivityIndicator color={COLORS.textSecondary} style={styles.optionIcon} />
          : <Text style={styles.optionIcon}>🖼️</Text>
        }
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Upload from gallery</Text>
          <Text style={styles.optionDesc}>Photo or video under 2 min</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary, padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 32 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 12,
  },
  optionIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  optionDesc: { fontSize: 13, color: COLORS.textSecondary },
})
