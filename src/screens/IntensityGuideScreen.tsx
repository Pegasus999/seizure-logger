import React, { useState } from 'react';
import { View } from 'react-native';

import { IntensityBadge } from '../components/IntensityBadge';
import { Button, Muted, Screen, TextField } from '../components/ui';
import { DEFAULT_INTENSITY_GUIDE, INTENSITY_META } from '../constants';
import { getActiveChild, saveChild } from '../db/repo';
import type { RootScreenProps } from '../navigation/types';
import { spacing } from '../theme';
import { INTENSITIES, type IntensityGuide } from '../types';

export default function IntensityGuideScreen({ navigation }: RootScreenProps<'IntensityGuide'>): React.JSX.Element {
  const [child] = useState(() => getActiveChild());
  const [guide, setGuide] = useState<IntensityGuide>(() => ({
    ...DEFAULT_INTENSITY_GUIDE,
    ...(child?.intensity_guide ?? {}),
  }));

  const save = (g: IntensityGuide | null) => {
    if (!child) return;
    saveChild({ ...child, intensity_guide: g });
    navigation.goBack();
  };

  return (
    <Screen scroll>
      <Muted>
        Rédigez-les avec vos propres mots et relisez-les avec le médecin, pour que les crises soient notées de façon cohérente. L'application ne détermine pas la gravité.
      </Muted>
      {INTENSITIES.map((i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <IntensityBadge intensity={i} size="lg" />
          <TextField
            accessibilityLabel={`Définition de l'intensité ${INTENSITY_META[i].label.toLowerCase()}`}
            multiline
            value={guide[i]}
            onChangeText={(t) => setGuide((g) => ({ ...g, [i]: t }))}
          />
        </View>
      ))}
      <Button
        label="Enregistrer"
        size="lg"
        onPress={() =>
          save({
            low: guide.low.trim(),
            medium: guide.medium.trim(),
            high: guide.high.trim(),
          })
        }
      />
      <Button label="Rétablir les définitions suggérées" variant="secondary" onPress={() => save(null)} />
    </Screen>
  );
}
