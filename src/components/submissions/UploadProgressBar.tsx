/**
 * UploadProgressBar.tsx
 * Simple horizontal progress bar for upload feedback. Receives a 0–1 progress
 * value and renders a filled bar. Pure presentational — no state of its own.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '@/utils/constants'

type Props = {
  progress: number // 0 to 1
}

export default function UploadProgressBar({ progress }: Props) {
  const pct = Math.round(progress * 100)
  // Width as a percentage string drives the fill bar.
  const fillWidth = `${pct}%` as const

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth }]} />
      </View>
      <Text style={styles.label}>{pct}%</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 6 },
  track: {
    width: '100%', height: 6,
    backgroundColor: COLORS.bgElevated, borderRadius: 3, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  label: { fontSize: 12, color: COLORS.textMuted },
})
