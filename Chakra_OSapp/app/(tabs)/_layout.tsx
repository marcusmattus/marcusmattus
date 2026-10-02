import { Tabs } from 'expo-router';
import { BookOpen, Circle, MessageCircle, User, Waves } from 'lucide-react-native';
import { colors, fontFamilies } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.coAccent,
        tabBarInactiveTintColor: colors.fg3,
        tabBarStyle: {
          backgroundColor: colors.bgPage,
          borderTopColor: colors.border1,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamilies.mono,
          fontSize: 9,
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Body',
          tabBarIcon: ({ color, size }) => <Circle color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="sound"
        options={{
          title: 'Sound',
          tabBarIcon: ({ color, size }) => <Waves color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
