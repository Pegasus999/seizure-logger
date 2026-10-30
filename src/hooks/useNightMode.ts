import * as Brightness from 'expo-brightness';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { getSetting, notifyChange, setSetting } from '../db/repo';
import { useDbChange } from '../db/useDbChange';

const NIGHT_BRIGHTNESS = 0.05;

export function setNightMode(on: boolean): void {
  setSetting('night_mode', on ? '1' : '0');
  notifyChange();
}

export function useNightMode(): void {
  useDbChange(); // re-render when the setting changes
  const on = getSetting('night_mode') === '1';

  useEffect(() => {
    if (!on) return;
    let saved: number | null = null;
    let dimmed = false;

    const dim = async () => {
      try {
        if (dimmed) return;
        dimmed = true;
        if (Platform.OS === 'ios' && saved === null) saved = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(NIGHT_BRIGHTNESS);
      } catch {
        // ignore
      }
    };
    const restore = async () => {
      try {
        if (!dimmed) return;
        dimmed = false;
        if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
        else if (saved !== null) await Brightness.setBrightnessAsync(saved);
      } catch {
        // ignore
      }
    };

    if (AppState.currentState === 'active') void dim();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void dim();
      else void restore();
    });
    return () => {
      sub.remove();
      void restore();
    };
  }, [on]);
}
