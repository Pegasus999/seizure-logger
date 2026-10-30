import * as Print from 'expo-print';
import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { DateField } from '../components/DateField';
import { IntensityBadge } from '../components/IntensityBadge';
import { Button, Card, Chip, ChipGroup, Muted, Screen, SectionTitle } from '../components/ui';
import { DEFAULT_INTENSITY_GUIDE } from '../constants';
import { getActiveChild, listEvents, saveChild } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { addDays, dayKey, formatDate, rangeForPreset } from '../lib/dates';
import { formatDuration } from '../lib/format';
import { computeStats } from '../lib/stats';
import { buildCsv } from '../report/csv';
import { exportCsv, exportPdf, reportFileName } from '../report/export';
import { buildReportHtml } from '../report/reportHtml';
import { colors, spacing, type } from '../theme';
import { INTENSITIES, type RangePreset } from '../types';

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: '30d', label: 'Last 30 days' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'since_visit', label: 'Since last visit' },
  { key: 'custom', label: 'Custom' },
];

type Busy = 'pdf' | 'print' | 'csv' | null;

export default function ReportScreen(): React.JSX.Element {
  const tick = useDbChange();
  const child = useMemo(() => getActiveChild(), [tick]);
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [customFrom, setCustomFrom] = useState<Date>(() => addDays(new Date(), -29));
  const [customTo, setCustomTo] = useState<Date>(() => new Date());
  const [busy, setBusy] = useState<Busy>(null);

  const lastVisit = child?.last_visit_date ?? null;
  const { from, to } = useMemo(
    () => rangeForPreset(preset, { lastVisitDate: lastVisit, from: customFrom, to: customTo }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, lastVisit, customFrom, customTo, tick],
  );
  const events = useMemo(
    () => listEvents({ from, to }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from.getTime(), to.getTime(), tick],
  );
  const stats = useMemo(() => computeStats(events, from, to), [events, from, to]);

  if (!child) {
    return (
      <Screen scroll edges={['top', 'left', 'right']}>
        <Muted>Set up a profile first.</Muted>
      </Screen>
    );
  }

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Could not export', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const html = () =>
    buildReportHtml({
      child,
      events,
      from,
      to,
      generatedAt: new Date(),
      guide: child.intensity_guide ?? DEFAULT_INTENSITY_GUIDE,
    });

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <SectionTitle>Period</SectionTitle>
      <ChipGroup>
        {PRESETS.map((p) => (
          <Chip key={p.key} label={p.label} selected={preset === p.key} onPress={() => setPreset(p.key)} />
        ))}
      </ChipGroup>

      {preset === 'since_visit' && !lastVisit ? (
        <View style={{ gap: spacing.sm }}>
          <DateField
            label="Last visit date"
            value={null}
            onChange={(d) => {
              if (d) saveChild({ ...child, last_visit_date: dayKey(d) });
            }}
          />
          <Muted>Not set yet. Showing the last 30 days until you pick a date.</Muted>
        </View>
      ) : null}
      {preset === 'custom' ? (
        <View style={{ gap: spacing.md }}>
          <DateField label="From" value={customFrom} onChange={(d) => d && setCustomFrom(d)} />
          <DateField label="To" value={customTo} onChange={(d) => d && setCustomTo(d)} />
        </View>
      ) : null}

      <Card>
        <SectionTitle>What the PDF will contain</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.md }}>
          {formatDate(from)} – {formatDate(to)}
        </Text>
        <Text style={{ color: colors.text, fontSize: type.lg, fontWeight: '700' }}>
          {stats.total} {stats.total === 1 ? 'entry' : 'entries'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          {INTENSITIES.map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <IntensityBadge intensity={i} size="sm" />
              <Text style={{ color: colors.text, fontSize: type.md, fontVariant: ['tabular-nums'] }}>
                {stats.byIntensity[i]}
              </Text>
            </View>
          ))}
        </View>
        <Muted>Average per week: {stats.avgPerWeek}</Muted>
        <Muted>
          Longest duration:{' '}
          {stats.longestDurationSeconds === null ? '—' : formatDuration(stats.longestDurationSeconds)}
        </Muted>
      </Card>

      <Button
        label="Generate PDF"
        size="lg"
        busy={busy === 'pdf'}
        busyLabel="Creating PDF…"
        disabled={!!busy}
        onPress={() =>
          run('pdf', () => exportPdf(html(), reportFileName(child.display_name, from, to, 'pdf')))
        }
      />
      <Button
        label="Preview / print"
        variant="secondary"
        busy={busy === 'print'}
        disabled={!!busy}
        onPress={() => run('print', () => Print.printAsync({ html: html() }))}
      />
      <Button
        label="Export CSV"
        variant="ghost"
        busy={busy === 'csv'}
        disabled={!!busy}
        onPress={() =>
          run('csv', () => exportCsv(buildCsv(events), reportFileName(child.display_name, from, to, 'csv')))
        }
      />
      <Muted>The PDF is created on this phone. Nothing is uploaded.</Muted>
    </Screen>
  );
}
