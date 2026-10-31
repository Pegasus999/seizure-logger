import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { INTENSITY_META } from '../constants';
import type { Intensity } from '../types';

export function IntensityBadge({
  intensity,
  size = 'sm',
}: {
  intensity: Intensity;
  size?: 'sm' | 'lg';
}): React.JSX.Element {
  const m = INTENSITY_META[intensity];
  const lg = size === 'lg';
  return (
    <View
      accessible
      accessibilityLabel={`Intensité ${m.label.toLowerCase()}`}
      style={[styles.pill, { backgroundColor: m.dimColor, borderColor: m.color }, lg && styles.pillLg]}
    >
      <Text style={{ color: m.color, fontSize: lg ? 20 : 13 }}>{m.glyph}</Text>
      <Text style={{ color: m.color, fontSize: lg ? 20 : 13, fontWeight: '700' }}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillLg: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
});
