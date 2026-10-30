import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Text } from 'react-native';

import { Button, Card, Muted, Row, Screen, SectionTitle, Toggle } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import {
  countDirty,
  getActiveChild,
  getSetting,
  listEvents,
  notifyChange,
  setSetting,
} from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { setNightMode } from '../hooks/useNightMode';
import { dayKey, formatDateTime } from '../lib/dates';
import type { TabScreenProps } from '../navigation/types';
import { buildCsv } from '../report/csv';
import { exportCsv } from '../report/export';
import { syncNow, useSyncStatus } from '../sync/sync';
import { colors, spacing, type } from '../theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function syncText(s: ReturnType<typeof useSyncStatus>): string {
  switch (s.state) {
    case 'idle':
      return 'Synced';
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return 'Offline — will sync when connected';
    case 'error':
      return `Error: ${s.error ?? 'unknown'}`;
    default:
      return 'Not backed up';
  }
}

export default function SettingsScreen({ navigation }: TabScreenProps<'Settings'>): React.JSX.Element {
  const tick = useDbChange();
  const auth = useAuth();
  const sync = useSyncStatus();
  const child = useMemo(() => getActiveChild(), [tick]);
  const nightMode = getSetting('night_mode') === '1';
  const appLock = getSetting('app_lock') === '1';
  const reminderOn = !!getSetting('reminder_id');
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const email = auth.session?.user?.email ?? null;
  const localOnly = auth.localOnly || sync.state === 'local_only';

  const toggleLock = async (on: boolean) => {
    if (!on) {
      setSetting('app_lock', '0');
      notifyChange();
      return;
    }
    try {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hw && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) {
        Alert.alert(
          'App lock unavailable',
          'Set up a screen lock, fingerprint or face unlock in your phone settings first, then try again.',
        );
        return;
      }
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on app lock' });
      if (!r.success) return;
      setSetting('app_lock', '1');
      notifyChange();
    } catch (e) {
      Alert.alert('App lock unavailable', e instanceof Error ? e.message : String(e));
    }
  };

  const toggleReminder = async (on: boolean) => {
    try {
      if (on) {
        const perm = await Notifications.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Notifications are off', 'Allow notifications for this app in your phone settings to get reminders.');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Reminders',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: null,
          });
        }
        const old = getSetting('reminder_id');
        if (old) await Notifications.cancelScheduledNotificationAsync(old).catch(() => {});
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Seizure log',
            body: "A gentle reminder to review this week's entries.",
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 1,
            hour: 19,
            minute: 0,
            channelId: 'reminders',
          },
        });
        setSetting('reminder_id', id);
      } else {
        const id = getSetting('reminder_id');
        if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        setSetting('reminder_id', null);
      }
      notifyChange();
    } catch (e) {
      Alert.alert('Reminder', e instanceof Error ? e.message : String(e));
    }
  };

  const doSyncNow = async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      await exportCsv(buildCsv(listEvents()), `seizure-log_all_${dayKey(new Date())}.csv`);
    } catch (e) {
      Alert.alert('Could not export', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const signOut = async () => {
    await syncNow();
    const n = countDirty();
    const go = async () => {
      const r = await auth.signOut();
      if (r.error) Alert.alert('Could not sign out', r.error);
    };
    if (n > 0) {
      Alert.alert(
        'Not everything has synced',
        `${n} ${n === 1 ? 'entry has' : 'entries have'} not synced yet and will be removed from this phone if you sign out.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out anyway', style: 'destructive', onPress: () => void go() },
        ],
      );
    } else {
      Alert.alert('Sign out?', 'Your entries are backed up. They will be removed from this phone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', onPress: () => void go() },
      ]);
    }
  };

  const deleteAll = () =>
    Alert.alert(
      'Delete account and all data?',
      localOnly
        ? 'This permanently deletes every entry on this phone.'
        : 'This permanently deletes your account and every entry, on this phone and in the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: () => {
                  void auth.deleteAccount().then((r) => {
                    if (r.error) Alert.alert('Could not delete', r.error);
                  });
                },
              },
            ]),
        },
      ],
    );

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <SectionTitle>Child</SectionTitle>
      <Card>
        <Row label={child?.display_name ?? 'Profile'} value="Edit" onPress={() => navigation.navigate('ProfileEdit')} />
        <Row label="Intensity definitions" onPress={() => navigation.navigate('IntensityGuide')} />
        <Row label="Symptoms" onPress={() => navigation.navigate('Symptoms')} />
      </Card>

      <SectionTitle>Night use</SectionTitle>
      <Card>
        <Toggle label="Night mode (minimum brightness)" value={nightMode} onValueChange={setNightMode} />
        <Toggle label="App lock" value={appLock} onValueChange={(v) => void toggleLock(v)} />
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        <Toggle
          label="Weekly reminder to review the log"
          description="Sundays at 19:00, silent"
          value={reminderOn}
          onValueChange={(v) => void toggleReminder(v)}
        />
      </Card>

      <SectionTitle>Sync</SectionTitle>
      {localOnly ? (
        <Card style={{ borderColor: colors.danger }}>
          <Text style={{ color: colors.text, fontSize: type.md }}>
            Supabase is not configured in this build, so entries are stored only on this phone.
          </Text>
        </Card>
      ) : null}
      <Card>
        <Row label="Status" value={syncText(sync)} />
        <Row label="Last synced" value={sync.lastSyncedAt ? formatDateTime(new Date(sync.lastSyncedAt)) : 'Never'} />
        <Row label="Waiting to sync" value={String(sync.pending)} />
        <Button
          label="Sync now"
          variant="secondary"
          busy={syncing || sync.state === 'syncing'}
          busyLabel="Syncing…"
          disabled={localOnly}
          onPress={() => void doSyncNow()}
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <Button
          label="Export all data (CSV)"
          variant="secondary"
          busy={exporting}
          onPress={() => void exportAll()}
        />
        <Row label="Privacy & about" onPress={() => navigation.navigate('About')} />
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        {!localOnly ? (
          <>
            {email ? <Row label="Signed in as" value={email} /> : null}
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
          </>
        ) : null}
        <Button label="Delete account and all data" variant="danger" onPress={deleteAll} />
        {localOnly ? <Muted>This wipes everything stored on this phone.</Muted> : null}
      </Card>
      <Text style={{ height: spacing.xl }} />
    </Screen>
  );
}
