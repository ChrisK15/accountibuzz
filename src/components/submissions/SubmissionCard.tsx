/**
 * SubmissionCard.tsx
 * Single row in the admin review queue list. Shows media type, a truncated
 * user ID, and submission time. Tapping calls onPress to open the detail view.
 */

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { type Submission } from '@/types/submission'
import { COLORS } from '@/utils/constants'

type Props = {
  submission: Submission
  onPress: () => void
}

export default function SubmissionCard({ submission, onPress }: Props) {
  const isVideo = submission.mediaType === 'video'
  const time = submission.submittedAt?.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }) ?? '--:--'
  const date = submission.submittedAt?.toDate().toLocaleDateString() ?? '---'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumbnail}>
        {isVideo ? (
          <Text style={styles.typeIcon}>🎥</Text>
        ) : (
          <Image source={{ uri: submission.mediaUrl }} style={styles.image} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.userId} numberOfLines={1}>
          {submission.displayName || submission.userId.slice(0, 12)}
        </Text>
        <Text style={styles.time}>{date} · {time}</Text>
        <Text style={styles.badge}>{isVideo ? 'Video' : 'Photo'}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: { width: 56, height: 56 },
  typeIcon: { fontSize: 24 },
  info: { flex: 1, gap: 4 },
  userId: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  time: { color: COLORS.textSecondary, fontSize: 12 },
  badge: { color: COLORS.textMuted, fontSize: 11 },
  chevron: { color: COLORS.textMuted, fontSize: 20 },
})
