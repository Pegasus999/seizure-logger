import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { getSetting } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { colors, spacing, type } from '../theme';
import { Button } from './ui';

const LOCK_AFTER_MS = 30_000;

export function AppLockGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  useDbChange();
  const enabled = getSetting('app_lock') === '1';
  const [locked, setLocked] = useState<boolean>(enabled);
  const [busy, setBusy] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setBusy(true);
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHw && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        setLocked(false);
        return;
      }
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Déverrouiller Journal des crises' });
      if (r.success) setLocked(false);
    } catch {
      // stay locked; user can retry
    } finally {
      prompting.current = false;
      setBusy(false);
    }
  }, []);

  // Auto-prompt once each time the lock appears.
  useEffect(() => {
    if (locked && enabled) void unlock();
  }, [locked, enabled, unlock]);

  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        backgroundedAt.current = Date.now();
      } else if (s === 'active') {
        const t = backgroundedAt.current;
        backgroundedAt.current = null;
        if (enabledRef.current && t !== null && Date.now() - t >= LOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.fill}>
      {children}
      {locked && enabled ? (
        <View style={styles.lock} accessibilityViewIsModal>
          <Text style={styles.title}>Journal des crises</Text>
          <Button label="Déverrouiller" size="lg" busy={busy} busyLabel="Déverrouillage…" onPress={() => void unlock()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  lock: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  title: { color: colors.text, fontSize: type.xl, fontWeight: '700' },
});
