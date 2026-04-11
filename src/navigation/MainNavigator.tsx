import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import HomeStackNavigator from './HomeStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
import AdminStackNavigator from './AdminStackNavigator';
import { MainTabParamList } from '@/types/navigation';
import { COLORS } from '@/utils/constants';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { HomeTab: '🏠', ProfileTab: '👤', AdminTab: '🛡️' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>;
}

export default function MainNavigator() {
  useOfflineQueue();
  const { firebaseUser } = useAuth();
  const { groups } = useGroups();
  const isAdmin = groups.some(g => g.ownerId === firebaseUser?.uid);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarStyle: { backgroundColor: COLORS.bgSurface, borderTopColor: COLORS.border },
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textMuted,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Groups' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ title: 'Profile' }} />
      <Tab.Screen
        name="AdminTab"
        component={AdminStackNavigator}
        options={{
          title: 'Admin',
          tabBarButton: isAdmin ? undefined : () => null,
        }}
      />
    </Tab.Navigator>
  );
}
