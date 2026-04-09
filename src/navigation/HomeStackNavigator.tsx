import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupListScreen from '@/screens/groups/GroupListScreen';
import GroupDetailScreen from '@/screens/groups/GroupDetailScreen';
import CreateGroupScreen from '@/screens/groups/CreateGroupScreen';
import LeaderboardScreen from '@/screens/leaderboard/LeaderboardScreen';
import { HomeStackParamList } from '@/types/navigation';
import { COLORS } from '@/utils/constants';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bgSurface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="GroupList" component={GroupListScreen} options={{ title: 'My Groups' }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Group' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Create Group' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
    </Stack.Navigator>
  );
}
