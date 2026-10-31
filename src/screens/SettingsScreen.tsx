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
      return 'Synchronisé';
    case 'syncing':
      return 'Synchronisation…';
    case 'offline':
      return 'Hors ligne — synchronisation dès le retour de la connexion';
    case 'error':
      return `Erreur : ${s.error ?? 'inconnue'}`;
    default:
      return 'Non sauvegardé';
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
          'Verrouillage indisponible',
          'Configurez d\'abord un verrouillage d\'écran, une empreinte digitale ou un déverrouillage facial dans les réglages du téléphone, puis réessayez.',
        );
        return;
      }
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Activer le verrouillage de l\'application' });
      if (!r.success) return;
      setSetting('app_lock', '1');
      notifyChange();
    } catch (e) {
      Alert.alert('Verrouillage indisponible', e instanceof Error ? e.message : String(e));
    }
  };

  const toggleReminder = async (on: boolean) => {
    try {
      if (on) {
        const perm = await Notifications.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Notifications désactivées', 'Autorisez les notifications pour cette application dans les réglages du téléphone pour recevoir des rappels.');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Rappels',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: null,
          });
        }
        const old = getSetting('reminder_id');
        if (old) await Notifications.cancelScheduledNotificationAsync(old).catch(() => {});
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Journal des crises',
            body: "Un petit rappel pour relire les crises de la semaine.",
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
      Alert.alert('Rappel', e instanceof Error ? e.message : String(e));
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
      await exportCsv(buildCsv(listEvents()), `journal-des-crises_tout_${dayKey(new Date())}.csv`);
    } catch (e) {
      Alert.alert('Export impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const signOut = async () => {
    await syncNow();
    const n = countDirty();
    const go = async () => {
      const r = await auth.signOut();
      if (r.error) Alert.alert('Déconnexion impossible', r.error);
    };
    if (n > 0) {
      Alert.alert(
        'Tout n\'est pas synchronisé',
        n > 1
          ? `${n} crises ne sont pas encore synchronisées et seront supprimées de ce téléphone si vous vous déconnectez.`
          : `${n} crise n'est pas encore synchronisée et sera supprimée de ce téléphone si vous vous déconnectez.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se déconnecter quand même', style: 'destructive', onPress: () => void go() },
        ],
      );
    } else {
      Alert.alert('Se déconnecter ?', 'Vos crises sont sauvegardées. Elles seront supprimées de ce téléphone.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', onPress: () => void go() },
      ]);
    }
  };

  const deleteAll = () =>
    Alert.alert(
      'Supprimer le compte et toutes les données ?',
      localOnly
        ? 'Cela supprime définitivement toutes les crises de ce téléphone.'
        : 'Cela supprime définitivement votre compte et toutes les crises, sur ce téléphone et dans le cloud.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () =>
            Alert.alert('En êtes-vous sûr ?', 'Cette action est irréversible.', [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Tout supprimer',
                style: 'destructive',
                onPress: () => {
                  void auth.deleteAccount().then((r) => {
                    if (r.error) Alert.alert('Suppression impossible', r.error);
                  });
                },
              },
            ]),
        },
      ],
    );

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <SectionTitle>Enfant</SectionTitle>
      <Card>
        <Row label={child?.display_name ?? 'Profil'} value="Modifier" onPress={() => navigation.navigate('ProfileEdit')} />
        <Row label="Guide des intensités" onPress={() => navigation.navigate('IntensityGuide')} />
        <Row label="Symptômes" onPress={() => navigation.navigate('Symptoms')} />
      </Card>

      <SectionTitle>Utilisation de nuit</SectionTitle>
      <Card>
        <Toggle label="Mode nuit (luminosité minimale)" value={nightMode} onValueChange={setNightMode} />
        <Toggle label="Verrouillage de l'application" value={appLock} onValueChange={(v) => void toggleLock(v)} />
      </Card>

      <SectionTitle>Rappels</SectionTitle>
      <Card>
        <Toggle
          label="Rappel hebdomadaire pour relire le journal"
          description="Le dimanche à 19:00, sans son"
          value={reminderOn}
          onValueChange={(v) => void toggleReminder(v)}
        />
      </Card>

      <SectionTitle>Synchronisation</SectionTitle>
      {localOnly ? (
        <Card style={{ borderColor: colors.danger }}>
          <Text style={{ color: colors.text, fontSize: type.md }}>
            La synchronisation n'est pas configurée dans cette version : les crises sont conservées uniquement sur ce téléphone.
          </Text>
        </Card>
      ) : null}
      <Card>
        <Row label="État" value={syncText(sync)} />
        <Row label="Dernière synchronisation" value={sync.lastSyncedAt ? formatDateTime(new Date(sync.lastSyncedAt)) : 'Jamais'} />
        <Row label="En attente" value={String(sync.pending)} />
        <Button
          label="Synchroniser maintenant"
          variant="secondary"
          busy={syncing || sync.state === 'syncing'}
          busyLabel="Synchronisation…"
          disabled={localOnly}
          onPress={() => void doSyncNow()}
        />
      </Card>

      <SectionTitle>Données</SectionTitle>
      <Card>
        <Button
          label="Exporter tout en CSV"
          variant="secondary"
          busy={exporting}
          onPress={() => void exportAll()}
        />
        <Row label="Confidentialité et à propos" onPress={() => navigation.navigate('About')} />
      </Card>

      <SectionTitle>Compte</SectionTitle>
      <Card>
        {!localOnly ? (
          <>
            {email ? <Row label="Connecté en tant que" value={email} /> : null}
            <Button label="Se déconnecter" variant="secondary" onPress={() => void signOut()} />
          </>
        ) : null}
        <Button label="Supprimer le compte et toutes les données" variant="danger" onPress={deleteAll} />
        {localOnly ? <Muted>Cela efface tout ce qui est stocké sur ce téléphone.</Muted> : null}
      </Card>
      <Text style={{ height: spacing.xl }} />
    </Screen>
  );
}
