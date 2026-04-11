/**
 * AdminStackNavigator.tsx
 * Stack for the Admin tab. Starts at AdminHome (group list) then drills into
 * ReviewQueue → ReviewDetail for each group the admin manages.
 */

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { AdminStackParamList } from '@/types/navigation'
import ReviewQueueScreen from '@/screens/admin/ReviewQueueScreen'
import ReviewDetailScreen from '@/screens/admin/ReviewDetailScreen'
import { useGroups } from '@/hooks/useGroups'
import { COLORS } from '@/utils/constants'

const Stack = createNativeStackNavigator<AdminStackParamList>()

// Inline component — simple enough not to warrant its own file.
function AdminHomeScreen({ navigation }: any) {
  const { groups, isLoading } = useGroups()

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.success} />
      </View>
    )
  }

  if (groups.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🛡️</Text>
        <Text style={styles.emptyTitle}>No groups yet</Text>
        <Text style={styles.emptySub}>Create or join a group to see submissions here.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={g => g.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.groupRow}
          onPress={() => navigation.navigate('ReviewQueue', {
            groupId: item.id,
            groupName: item.challengeTitle,
          })}
          activeOpacity={0.7}
        >
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.challengeTitle}</Text>
            <Text style={styles.groupMode}>{item.mode}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
    />
  )
}

export default function AdminStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bgSurface },
        headerTintColor: COLORS.textPrimary,
      }}
    >
      <Stack.Screen
        name="AdminHome"
        component={AdminHomeScreen}
        options={{ title: 'Review Queue' }}
      />
      <Stack.Screen
        name="ReviewQueue"
        component={ReviewQueueScreen}
        options={({ route }) => ({ title: (route.params as any).groupName ?? 'Pending' })}
      />
      <Stack.Screen
        name="ReviewDetail"
        component={ReviewDetailScreen}
        options={{ title: 'Review Submission', headerBackTitle: 'Queue' }}
      />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: COLORS.bgPrimary },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  list: { padding: 16, gap: 10 },
  groupRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface, borderRadius: 12,
    padding: 16,
  },
  groupInfo: { flex: 1, gap: 4 },
  groupName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  groupMode: { color: COLORS.textSecondary, fontSize: 13, textTransform: 'capitalize' },
  chevron: { color: COLORS.textMuted, fontSize: 20 },
})
