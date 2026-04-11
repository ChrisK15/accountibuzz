/**
 * HomeStackNavigator.tsx
 * Stack navigator for the Home tab — groups, group detail, creation, and invite flows.
 * All group-related screens live here so they share a single navigation history.
 */

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import GroupListScreen from '@/screens/groups/GroupListScreen'
import GroupDetailScreen from '@/screens/groups/GroupDetailScreen'
import CreateGroupScreen from '@/screens/groups/CreateGroupScreen'
import InviteLinkScreen from '@/screens/groups/InviteLinkScreen'
import JoinGroupScreen from '@/screens/groups/JoinGroupScreen'
import GroupSettingsScreen from '@/screens/groups/GroupSettingsScreen'
import ConfigureChallengeScreen from '@/screens/groups/ConfigureChallengeScreen'
import ManageMembersScreen from '@/screens/groups/ManageMembersScreen'
import SubmitChoiceScreen from '@/screens/submissions/SubmitChoiceScreen'
import CameraScreen from '@/screens/submissions/CameraScreen'
import SubmissionPreviewScreen from '@/screens/submissions/SubmissionPreviewScreen'
import LeaderboardScreen from '@/screens/leaderboard/LeaderboardScreen'
import { HomeStackParamList } from '@/types/navigation'
import { COLORS } from '@/utils/constants'

const Stack = createNativeStackNavigator<HomeStackParamList>()

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
      <Stack.Screen name="InviteLink" component={InviteLinkScreen} options={{ title: 'Invite Friends' }} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: 'Join Group' }} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ title: 'Group Settings' }} />
      <Stack.Screen name="ConfigureChallenge" component={ConfigureChallengeScreen} options={{ title: 'Configure Challenge' }} />
      <Stack.Screen name="ManageMembers" component={ManageMembersScreen} options={{ title: 'Manage Members' }} />
      <Stack.Screen name="SubmitChoice" component={SubmitChoiceScreen} options={{ title: 'Submit Proof' }} />
      <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SubmissionPreview" component={SubmissionPreviewScreen} options={{ title: 'Preview' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
    </Stack.Navigator>
  )
}
