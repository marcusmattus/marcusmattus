import { Stack } from 'expo-router';
import { JournalProvider } from '@/lib/journalStore';
import { colors } from '@/theme/tokens';

export default function JournalLayout() {
  return (
    <JournalProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPage },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
      </Stack>
    </JournalProvider>
  );
}
