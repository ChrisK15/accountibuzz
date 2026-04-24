import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="groups/new" options={{ headerShown: false }} />
      <Stack.Screen name="groups/join" options={{ headerShown: false }} />
      <Stack.Screen name="groups/[id]/index" options={{ headerShown: false }} />
    </Stack>
  );
}
