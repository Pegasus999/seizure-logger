import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { IntensityBadge } from '../components/IntensityBadge';
import { Button, Card, Chip, ChipGroup, Muted, Screen, SectionTitle, TextField } from '../components/ui';
import { AFTER_EFFECTS, CONTEXT_TAGS, DURATION_PRESETS, INTENSITY_META, UNDO_WINDOW_MS } from '../constants';
import {
  addCustomSymptom,
  deleteEvent,
  getEvent,
  listSymptoms,
  setEventContextTags,
  setEventSymptoms,
  undoEvent,
  updateEvent,
} from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { formatDateTime } from '../lib/dates';
import type { RootScreenProps } from '../navigation/types';
import { colors, spacing, type } from '../theme';
import { INTENSITIES, type AfterEffect, type ContextTag } from '../types';

export default function EventDetailsScreen({ route, navigation }: RootScreenProps<'EventDetails'>): React.JSX.Element | null {
  const { eventId, isNew } = route.params;
  const tick = useDbChange();
  const ev = useMemo(() => getEvent(eventId), [eventId, tick]);
  const symptoms = useMemo(() => listSymptoms(), [tick]);

  const [notes, setNotes] = useState<string | null>(null);
  const notesRef = useRef<string | null>(null);
  const [seconds, setSeconds] = useState<string | null>(null);
  const [addingSymptom, setAddingSymptom] = useState(false);
  const [newSymptom, setNewSymptom] = useState('');
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [now, setNow] = useState(Date.now());
  const missing = useRef(false);

  useEffect(() => {
    if (!ev && !missing.current) {
      missing.current = true;
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [ev, navigation]);

  // Keep latest notes for save-on-unmount.
  const notesSaved = useRef<string | null>(null);
  if (ev && notesRef.current === null && notes === null) {
    notesRef.current = ev.notes ?? '';
    notesSaved.current = ev.notes ?? '';
  }
  const saveNotes = useCallback(() => {
    const v = notesRef.current;
    if (v === null || v === notesSaved.current || missing.current) return;
    notesSaved.current = v;
    updateEvent(eventId, { notes: v.trim() ? v : null });
  }, [eventId]);
  useEffect(() => () => saveNotes(), [saveNotes]);

  const undoLeft = ev ? new Date(ev.created_at).getTime() + UNDO_WINDOW_MS - now : 0;
  useEffect(() => {
    if (!isNew || undoLeft <= 0) return;
    const t = setTimeout(() => setNow(Date.now()), undoLeft + 50);
    return () => clearTimeout(t);
  }, [isNew, undoLeft]);

  if (!ev) return <Screen>{null}</Screen>;

  const selectedSymptoms = new Set(ev.symptoms.map((s) => s.id));
  const toggleSymptom = (id: string) => {
    const next = new Set(selectedSymptoms);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEventSymptoms(eventId, [...next]);
  };
  const toggleTag = (tag: ContextTag) => {
    const next = ev.context_tags.includes(tag) ? ev.context_tags.filter((t) => t !== tag) : [...ev.context_tags, tag];
    setEventContextTags(eventId, next);
  };
  const addSymptom = () => {
    const label = newSymptom.trim();
    if (!label) return;
    const s = addCustomSymptom(label);
    setEventSymptoms(eventId, [...new Set([...selectedSymptoms, s.id])]);
    setNewSymptom('');
    setAddingSymptom(false);
  };

  const when = new Date(ev.occurred_at);
  const openTime = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: when,
        mode: 'date',
        onChange: (e, d) => {
          if (e.type !== 'set' || !d) return;
          DateTimePickerAndroid.open({
            value: d,
            mode: 'time',
            is24Hour: true,
            onChange: (e2, d2) => {
              if (e2.type === 'set' && d2) updateEvent(eventId, { occurred_at: d2.toISOString() });
            },
          });
        },
      });
    } else {
      setShowIosPicker((v) => !v);
    }
  };

  const durationMatches = DURATION_PRESETS.some((p) => p.seconds === ev.duration_seconds);
  const secondsText = seconds ?? (ev.duration_seconds !== null && !durationMatches ? String(ev.duration_seconds) : '');
  const commitSeconds = () => {
    if (seconds === null) return;
    const n = Number(seconds.trim());
    if (!seconds.trim()) updateEvent(eventId, { duration_seconds: null });
    else if (Number.isFinite(n) && n >= 0) updateEvent(eventId, { duration_seconds: Math.round(n) });
    setSeconds(null);
  };

  const confirmDelete = () =>
    Alert.alert('Supprimer cette crise ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          missing.current = true;
          deleteEvent(eventId);
          navigation.goBack();
        },
      },
    ]);

  const done = () => {
    saveNotes();
    navigation.goBack();
  };

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ gap: spacing.xs, flexShrink: 1 }}>
          <IntensityBadge intensity={ev.intensity} size="lg" />
          <Text style={{ color: colors.text, fontSize: type.lg }}>{formatDateTime(when)}</Text>
        </View>
        <Button label={isNew ? 'Passer' : 'Terminé'} variant="secondary" size="lg" onPress={done} />
      </View>

      {isNew ? (
        <Card>
          <Text style={{ color: colors.text, fontSize: type.md }}>Enregistrée. Ajoutez des détails ou passez.</Text>
          {undoLeft > 0 ? (
            <Pressable
              accessibilityRole="button"
              style={{ minHeight: 48, justifyContent: 'center' }}
              onPress={() => {
                missing.current = true;
                undoEvent(eventId);
                navigation.goBack();
              }}
            >
              <Text style={{ color: colors.accent, fontSize: type.md, fontWeight: '600' }}>Annuler</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      <SectionTitle>Heure</SectionTitle>
      <Button label={formatDateTime(when)} variant="secondary" onPress={openTime} />
      {Platform.OS === 'ios' && showIosPicker ? (
        <DateTimePicker
          value={when}
          mode="datetime"
          display="spinner"
          themeVariant="dark"
          onChange={(_e, d) => {
            if (d) updateEvent(eventId, { occurred_at: d.toISOString() });
          }}
        />
      ) : null}

      <SectionTitle>Intensité</SectionTitle>
      <ChipGroup>
        {INTENSITIES.map((i) => (
          <Chip
            key={i}
            label={`${INTENSITY_META[i].glyph} ${INTENSITY_META[i].label}`}
            color={INTENSITY_META[i].color}
            selected={ev.intensity === i}
            onPress={() => updateEvent(eventId, { intensity: i })}
          />
        ))}
      </ChipGroup>

      <SectionTitle>Symptômes</SectionTitle>
      <ChipGroup>
        {symptoms.map((s) => (
          <Chip key={s.id} label={s.label} selected={selectedSymptoms.has(s.id)} onPress={() => toggleSymptom(s.id)} />
        ))}
        {addingSymptom ? null : <Chip label="+ Ajouter un symptôme" onPress={() => setAddingSymptom(true)} />}
      </ChipGroup>
      {addingSymptom ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
          <TextField
            style={{ flex: 1 }}
            placeholder="Nouveau symptôme"
            value={newSymptom}
            onChangeText={setNewSymptom}
            onSubmitEditing={addSymptom}
            autoFocus
          />
          <Button label="Ajouter" onPress={addSymptom} />
        </View>
      ) : null}

      <SectionTitle>Durée</SectionTitle>
      <ChipGroup>
        {DURATION_PRESETS.map((p) => (
          <Chip
            key={p.seconds}
            label={p.label}
            selected={ev.duration_seconds === p.seconds}
            onPress={() => {
              setSeconds(null);
              updateEvent(eventId, { duration_seconds: ev.duration_seconds === p.seconds ? null : p.seconds });
            }}
          />
        ))}
      </ChipGroup>
      <TextField
        label="Secondes exactes"
        value={secondsText}
        onChangeText={(t) => setSeconds(t.replace(/\D/g, ''))}
        onBlur={commitSeconds}
        keyboardType="number-pad"
      />

      <SectionTitle>Effet après la crise</SectionTitle>
      <ChipGroup>
        {(Object.keys(AFTER_EFFECTS) as AfterEffect[]).map((a) => (
          <Chip
            key={a}
            label={AFTER_EFFECTS[a]}
            selected={ev.after_effect === a}
            onPress={() => updateEvent(eventId, { after_effect: ev.after_effect === a ? null : a })}
          />
        ))}
      </ChipGroup>

      <SectionTitle>Contexte</SectionTitle>
      <ChipGroup>
        {(Object.keys(CONTEXT_TAGS) as ContextTag[]).map((t) => (
          <Chip key={t} label={CONTEXT_TAGS[t]} selected={ev.context_tags.includes(t)} onPress={() => toggleTag(t)} />
        ))}
      </ChipGroup>

      <TextField
        label="Notes"
        multiline
        value={notes ?? ev.notes ?? ''}
        onChangeText={(t) => {
          notesRef.current = t;
          setNotes(t);
        }}
        onBlur={saveNotes}
      />

      {!isNew ? (
        <>
          <Muted>Les modifications sont enregistrées automatiquement.</Muted>
          <Button label="Supprimer la crise" variant="danger" onPress={confirmDelete} />
        </>
      ) : null}
    </Screen>
  );
}
