import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { getActiveChild } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import AboutScreen from '../screens/AboutScreen';
import EventDetailsScreen from '../screens/EventDetailsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import InsightsScreen from '../screens/InsightsScreen';
import IntensityGuideScreen from '../screens/IntensityGuideScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ReportScreen from '../screens/ReportScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignInScreen from '../screens/SignInScreen';
import SymptomsScreen from '../screens/SymptomsScreen';
import { startAutoSync } from '../sync/sync';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, React.ComponentProps<typeof Ionicons>['name']> = {
  Log: 'pulse-outline',
  History: 'list-outline',
  Insights: 'bar-chart-outline',
  Report: 'document-text-outline',
  Settings: 'settings-outline',
};

const headerStyle = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text },
  headerShadowVisible: false,
} as const;

function MainTabs(): React.JSX.Element {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        ...headerStyle,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} size={size} color={color} />,
      })}
    >
      <Tabs.Screen name="Log" component={HomeScreen} options={{ headerShown: false }} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen name="Insights" component={InsightsScreen} />
      <Tabs.Screen name="Report" component={ReportScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator(): React.JSX.Element {
  const { userId, loading, localOnly } = useAuth();
  const tick = useDbChange();
  const hasChild = React.useMemo(() => (userId ? getActiveChild() !== null : false), [userId, tick]);

  useEffect(() => {
    if (!userId) return;
    return startAutoSync();
  }, [userId]);

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!userId && !localOnly) return <SignInScreen />;
  if (!hasChild) return <ProfileSetupScreen />;

  return (
    <Stack.Navigator screenOptions={{ ...headerStyle, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ presentation: 'modal', headerShown: false, title: 'Entry' }}
      />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="IntensityGuide" component={IntensityGuideScreen} options={{ title: 'Intensity guide' }} />
      <Stack.Screen name="Symptoms" component={SymptomsScreen} options={{ title: 'Symptoms' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
    </Stack.Navigator>
  );
}
