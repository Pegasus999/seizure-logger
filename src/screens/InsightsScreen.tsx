import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { HourBars, WeeklyStackedBars } from '../components/charts';
import { IntensityBadge } from '../components/IntensityBadge';
import { Card, Chip, ChipGroup, Muted, Screen, SectionTitle } from '../components/ui';
import { listEvents } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { addDays, endOfDay, MONTH_NAMES_SHORT, startOfDay } from '../lib/dates';
import { formatDecimal } from '../lib/format';
import { computeStats } from '../lib/stats';
import { colors, spacing, type } from '../theme';
import { INTENSITIES } from '../types';

type Range = '4w' | '3m' | '12m';
const RANGES: { key: Range; label: string }[] = [
  { key: '4w', label: '4 dernières semaines' },
  { key: '3m', label: '3 derniers mois' },
  { key: '12m', label: '12 derniers mois' },
];

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${MONTH_NAMES_SHORT[Number(mo) - 1] ?? mo} ${y}`;
}

const num = { color: colors.text, fontSize: type.md, fontVariant: ['tabular-nums'] as const, textAlign: 'right' as const };

export default function InsightsScreen(): React.JSX.Element {
  const tick = useDbChange();
  const [range, setRange] = useState<Range>('4w');

  const stats = useMemo(() => {
    const now = new Date();
    const to = endOfDay(now);
    const from =
      range === '4w'
        ? startOfDay(addDays(now, -27))
        : startOfDay(new Date(now.getFullYear(), now.getMonth() - (range === '3m' ? 3 : 12), now.getDate()));
    return computeStats(listEvents({ from, to }), from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, range]);

  const Tile = ({ label, value, children }: { label?: string; value: string; children?: React.ReactNode }) => (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '30%',
        minWidth: 90,
        backgroundColor: colors.surfaceAlt,
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      {children}
      {label ? <Muted>{label}</Muted> : null}
      <Text style={{ color: colors.text, fontSize: type.xl, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <ChipGroup>
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />
        ))}
      </ChipGroup>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Tile label="Total" value={String(stats.total)} />
        {INTENSITIES.map((i) => (
          <Tile key={i} value={String(stats.byIntensity[i])}>
            <IntensityBadge intensity={i} size="sm" />
          </Tile>
        ))}
        <Tile label="Moyenne par semaine" value={formatDecimal(stats.avgPerWeek)} />
      </View>

      <Card>
        <SectionTitle>Crises par semaine</SectionTitle>
        <WeeklyStackedBars weekly={stats.weekly} />
      </Card>

      <Card>
        <SectionTitle>Crises par mois</SectionTitle>
        {stats.total === 0 ? (
          <Muted>Aucune crise sur cette période.</Muted>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row' }}>
              <Muted style={{ flex: 2 }}>Mois</Muted>
              {INTENSITIES.map((i) => (
                <Muted key={i} style={{ flex: 1, textAlign: 'right' }}>
                  {i === 'low' ? 'Lég.' : i === 'medium' ? 'Mod.' : 'Forte'}
                </Muted>
              ))}
              <Muted style={{ flex: 1, textAlign: 'right' }}>Total</Muted>
            </View>
            {stats.monthly.map((m) => (
              <View key={m.month} style={{ flexDirection: 'row', minHeight: 32, alignItems: 'center' }}>
                <Text style={{ flex: 2, color: colors.text, fontSize: type.md }}>{monthLabel(m.month)}</Text>
                <Text style={[num, { flex: 1 }]}>{m.low}</Text>
                <Text style={[num, { flex: 1 }]}>{m.medium}</Text>
                <Text style={[num, { flex: 1 }]}>{m.high}</Text>
                <Text style={[num, { flex: 1, fontWeight: '700' }]}>{m.low + m.medium + m.high}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle>Heure de la nuit</SectionTitle>
        <HourBars byHour={stats.byHour} />
      </Card>

      <Card>
        <SectionTitle>Symptômes les plus fréquents</SectionTitle>
        {stats.topSymptoms.length === 0 ? (
          <Muted>Aucun symptôme noté sur cette période.</Muted>
        ) : (
          stats.topSymptoms.slice(0, 5).map((s) => (
            <View key={s.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <Text style={{ color: colors.text, fontSize: type.md, flexShrink: 1 }}>{s.label}</Text>
              <Text style={{ color: colors.textDim, fontSize: type.md, fontVariant: ['tabular-nums'] }}>{s.count}</Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
