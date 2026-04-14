/**
 * ReviewQueueScreen.tsx
 * Shows all pending submissions for a group. Admins tap a card to open
 * ReviewDetailScreen where they can approve, reject, or flag.
 * SCRUM-25.
 */

import React from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AdminStackParamList } from '@/types/navigation'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import SubmissionCard from '@/components/submissions/SubmissionCard'
import { COLORS } from '@/utils/constants'

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'ReviewQueue'>
  route: RouteProp<AdminStackParamList, 'ReviewQueue'>
}

export default function ReviewQueueScreen({ navigation, route }: Props) {
  const { groupId } = route.params
  const { submissions, isLoading } = useReviewQueue(groupId)

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.success} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {submissions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending submissions to review.</Text>
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SubmissionCard
              submission={item}
              onPress={() => navigation.navigate('ReviewDetail', {
                submissionId: item.id,
                groupId,
              })}
            />
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  list: { padding: 16 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary },
})
