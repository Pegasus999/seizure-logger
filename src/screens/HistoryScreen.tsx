import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';

import { DateField } from '../components/DateField';
import { IntensityBadge } from '../components/IntensityBadge';
import { Chip, ChipGroup, Muted, Screen } from '../components/ui';
import { INTENSITY_META } from '../constants';
import { listEvents } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import {
  addDays,
  dayKey,
  endOfDay,
  formatDayHeading,
  formatTime,
  startOfDay,
} from '../lib/dates';
import { formatDuration, symptomSummary } from '../lib/format';
import type { TabScreenProps } from '../navigation/types';
import { colors, radius, spacing, type } from '../theme';
import { INTENSITIES, type EventWithDetails, type Intensity } from '../types';

type Range = 'all' | '7d' | '30d' | '3m' | 'custom';
const RANGES: { key: Range; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '3m', label: '3 months' },
  { key: 'custom', label: 'Custom' },
];

interface Section {
  key: string;
  title: string;
  count: number;
  data: EventWithDetails[];
}

export default function HistoryScreen({ navigation }: TabScreenProps<'History'>): React.JSX.Element {
  const tick = useDbChange();
  const [selected, setSelected] = useState<Intensity[]>([]);
  const [range, setRange] = useState<Range>('all');
  const [customFrom, setCustomFrom] = useState<Date>(() => addDays(new Date(), -29));
  const [customTo, setCustomTo] = useState<Date>(() => new Date());

  const bounds = useMemo((): { from?: Date; to?: Date } => {
    const now = new Date();
    switch (range) {
      case '7d':
        return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
      case '30d':
        return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) };
      case '3m':
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())),
          to: endOfDay(now),
        };
      case 'custom': {
        const [lo, hi] =
          customFrom.getTime() <= customTo.getTime() ? [customFrom, customTo] : [customTo, customFrom];
        return { from: startOfDay(lo), to: endOfDay(hi) };
      }
      default:
        return {};
    }
  }, [range, customFrom, customTo]);

  const selectedKey = selected.join(',');
  const fromMs = bounds.from?.getTime();
  const toMs = bounds.to?.getTime();
  const sections = useMemo((): Section[] => {
    const events = listEvents({
      from: bounds.from,
      to: bounds.to,
      intensities: selected.length > 0 ? selected : undefined,
    });
    const out: Section[] = [];
    const now = new Date();
    for (const ev of events) {
      const d = new Date(ev.occurred_at);
      const k = dayKey(d);
      let s = out[out.length - 1];
      if (!s || s.key !== k) {
        s = { key: k, title: formatDayHeading(d, now), count: 0, data: [] };
        out.push(s);
      }
      s.data.push(ev);
      s.count += 1;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, selectedKey, fromMs, toMs]);

  const toggle = (i: Intensity) =>
    setSelected((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <ChipGroup>
        {INTENSITIES.map((i) => (
          <Chip
            key={i}
            label={`${INTENSITY_META[i].glyph} ${INTENSITY_META[i].label}`}
            color={INTENSITY_META[i].color}
            selected={selected.includes(i)}
            onPress={() => toggle(i)}
          />
        ))}
      </ChipGroup>
      <ChipGroup>
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />
        ))}
      </ChipGroup>
      {range === 'custom' ? (
        <View style={{ gap: spacing.md }}>
          <DateField label="From" value={customFrom} onChange={(d) => d && setCustomFrom(d)} />
          <DateField label="To" value={customTo} onChange={(d) => d && setCustomTo(d)} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top', 'left', 'right']} contentStyle={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <Muted style={{ fontSize: type.md, paddingVertical: spacing.lg }}>
            {selected.length > 0 || range !== 'all'
              ? 'No entries match these filters.'
              : 'No entries yet. Logged seizures will appear here.'}
          </Muted>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ color: colors.textDim, fontSize: type.sm, fontWeight: '600' }}>
              {section.title} · {section.count}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const when = new Date(item.occurred_at);
          const syms = symptomSummary(item.symptoms.map((s) => s.label));
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${INTENSITY_META[item.intensity].label} at ${formatTime(when)}`}
              onPress={() => navigation.navigate('EventDetails', { eventId: item.id })}
              style={({ pressed }) => ({
                minHeight: 64,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius,
                padding: spacing.md,
                marginBottom: index < section.data.length - 1 ? spacing.sm : 0,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: type.lg,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatTime(when)}
              </Text>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <IntensityBadge intensity={item.intensity} size="sm" />
                  {item.duration_seconds !== null ? (
                    <Text style={{ color: colors.text, fontSize: type.sm }}>
                      {formatDuration(item.duration_seconds)}
                    </Text>
                  ) : null}
                </View>
                {syms ? <Muted>{syms}</Muted> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
