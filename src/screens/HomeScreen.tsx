import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Muted } from '../components/ui';
import { UndoToast, type ToastData } from '../components/UndoToast';
import { DEFAULT_INTENSITY_GUIDE, INTENSITY_META } from '../constants';
import { getActiveChild, listEvents, logEvent, undoEvent } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { formatTime } from '../lib/dates';
import type { TabScreenProps } from '../navigation/types';
import { colors, LOG_BUTTON_MIN_HEIGHT, radius, spacing } from '../theme';
import { INTENSITIES, type Intensity } from '../types';

export default function HomeScreen({ navigation }: TabScreenProps<'Log'>): React.JSX.Element {
  const tick = useDbChange();
  const child = useMemo(() => getActiveChild(), [tick]);
  const count = useMemo(
    () => listEvents({ from: new Date(Date.now() - 12 * 3600 * 1000) }).length,
    [tick],
  );
  const guide = child?.intensity_guide ?? DEFAULT_INTENSITY_GUIDE;
  const pressedAt = useRef<Partial<Record<Intensity, Date>>>({});
  const [toast, setToast] = useState<ToastData | null>(null);
  const hide = useCallback(() => setToast(null), []);

  const onLog = (intensity: Intensity) => {
    const when = pressedAt.current[intensity] ?? new Date();
    pressedAt.current[intensity] = undefined;
    const ev = logEvent(intensity, when); // first, synchronously
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const details = () => navigation.navigate('EventDetails', { eventId: ev.id, isNew: true });
    if (intensity === 'high') details();
    setToast({
      key: ev.id,
      message: `Crise enregistrée : ${INTENSITY_META[intensity].label.toLowerCase()} · ${formatTime(when)}`,
      onUndo: () => {
        undoEvent(ev.id);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setToast({ key: `${ev.id}-removed`, message: 'Crise supprimée', durationMs: 2000 });
      },
      onDetails: details,
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.name}>{child?.display_name ?? ''}</Text>
        <Muted>{count} {count > 1 ? 'crises' : 'crise'} au cours des 12 dernières heures</Muted>
      </View>
      <View style={styles.buttons}>
        {INTENSITIES.map((i) => {
          const m = INTENSITY_META[i];
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Enregistrer maintenant une crise ${m.label.toLowerCase()}`}
              onPressIn={() => {
                pressedAt.current[i] = new Date();
              }}
              onPress={() => onLog(i)}
              style={({ pressed }) => [
                styles.logButton,
                { backgroundColor: pressed ? colors.bg : m.dimColor, borderColor: m.color },
              ]}
            >
              <Text style={[styles.logLabel, { color: m.color }]}>
                {m.glyph} {m.label}
              </Text>
              <Text style={styles.guide} numberOfLines={2}>
                {guide[i]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Muted style={styles.hint}>Enregistrée à l'instant où vous touchez. Vous pourrez ajuster l'heure ensuite.</Muted>
      <UndoToast toast={toast} onHide={hide} bottom={spacing.xl} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  header: { paddingVertical: spacing.md, gap: 2 },
  name: { color: colors.text, fontSize: 20, fontWeight: '600' },
  buttons: { flex: 1, gap: 12 },
  logButton: {
    flex: 1,
    minHeight: LOG_BUTTON_MIN_HEIGHT,
    borderWidth: 2,
    borderRadius: radius,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  logLabel: { fontSize: 28, fontWeight: '700' },
  guide: { color: colors.textDim, fontSize: 13 },
  hint: { textAlign: 'center', paddingVertical: spacing.md },
});
