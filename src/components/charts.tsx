import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { INTENSITY_META } from '../constants';
import { MONTH_NAMES_SHORT, parseLocalDate } from '../lib/dates';
import { colors, spacing } from '../theme';
import { INTENSITIES, type WeekBucket } from '../types';
import { IntensityBadge } from './IntensityBadge';
import { Muted } from './ui';

const EMPTY = 'No entries in this period.';
const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 22;

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.floor(e.nativeEvent.layout.width))];
}

function niceTicks(max: number): number[] {
  const m = Math.max(1, Math.ceil(max));
  const step = Math.max(1, Math.ceil(m / 4));
  const top = Math.ceil(m / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

function weekLabel(weekStart: string): string {
  const d = parseLocalDate(weekStart);
  if (!d) return weekStart;
  const day = d.getDate();
  return `${day < 10 ? '0' : ''}${day} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
}

export function WeeklyStackedBars({
  weekly,
  height = 180,
}: {
  weekly: WeekBucket[];
  height?: number;
}): React.JSX.Element {
  const [width, onLayout] = useWidth();
  const total = weekly.reduce((s, w) => s + w.low + w.medium + w.high, 0);
  if (weekly.length === 0 || total === 0) return <Muted>{EMPTY}</Muted>;

  const max = Math.max(...weekly.map((w) => w.low + w.medium + w.high));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / weekly.length;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(weekly.length / 6));

  return (
    <View style={{ gap: spacing.md }}>
      <View onLayout={onLayout} style={{ width: '100%', height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <G key={`t${t}`}>
                <Line x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
                <SvgText x={PAD_L - 6} y={y(t) + 4} fontSize={11} fill={colors.textDim} textAnchor="end">
                  {String(t)}
                </SvgText>
              </G>
            ))}
            {weekly.map((w, i) => {
              const x = PAD_L + slot * i + (slot - barW) / 2;
              let acc = 0;
              return (
                <G key={w.weekStart}>
                  {INTENSITIES.map((k) => {
                    const v = w[k];
                    if (v <= 0) return null;
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    return (
                      <Rect
                        key={k}
                        x={x}
                        y={y1}
                        width={barW}
                        height={Math.max(0, y0 - y1)}
                        fill={INTENSITY_META[k].color}
                      />
                    );
                  })}
                  {i % every === 0 ? (
                    <SvgText
                      x={x + barW / 2}
                      y={height - 6}
                      fontSize={10}
                      fill={colors.textDim}
                      textAnchor="middle"
                    >
                      {weekLabel(w.weekStart)}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {INTENSITIES.map((k) => (
          <IntensityBadge key={k} intensity={k} size="sm" />
        ))}
      </View>
    </View>
  );
}

const HOUR_ORDER = Array.from({ length: 24 }, (_, i) => (18 + i) % 24);

export function HourBars({ byHour }: { byHour: number[] }): React.JSX.Element {
  const [width, onLayout] = useWidth();
  const total = byHour.reduce((s, n) => s + n, 0);
  if (total === 0) return <Muted>{EMPTY}</Muted>;

  const height = 150;
  const ticks = niceTicks(Math.max(...byHour));
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / 24;
  const barW = Math.max(2, slot * 0.7);
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <G key={`t${t}`}>
              <Line x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={PAD_L - 6} y={y(t) + 4} fontSize={11} fill={colors.textDim} textAnchor="end">
                {String(t)}
              </SvgText>
            </G>
          ))}
          {HOUR_ORDER.map((h, i) => {
            const v = byHour[h] ?? 0;
            const x = PAD_L + slot * i + (slot - barW) / 2;
            return (
              <G key={h}>
                {v > 0 ? (
                  <Rect x={x} y={y(v)} width={barW} height={y(0) - y(v)} fill={colors.accent} />
                ) : null}
                {i % 3 === 0 ? (
                  <SvgText x={x + barW / 2} y={height - 6} fontSize={10} fill={colors.textDim} textAnchor="middle">
                    {h < 10 ? `0${h}` : String(h)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

