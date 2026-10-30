import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { AppLockGate } from './src/components/AppLockGate';
import { initDb } from './src/db/db';
import { useNightMode } from './src/hooks/useNightMode';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';

initDb();
void SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function NightMode(): null {
  useNightMode();
  return null;
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <AuthProvider>
        <NightMode />
        <AppLockGate>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AppLockGate>
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
