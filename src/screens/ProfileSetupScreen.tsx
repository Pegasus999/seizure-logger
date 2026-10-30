import React from 'react';
import { Text, View } from 'react-native';

import { IntensityBadge } from '../components/IntensityBadge';
import { ProfileForm } from '../components/ProfileForm';
import { Card, Muted, Screen, SectionTitle } from '../components/ui';
import { DEFAULT_INTENSITY_GUIDE } from '../constants';
import { saveChild } from '../db/repo';
import { colors, spacing, type } from '../theme';
import { INTENSITIES } from '../types';

export default function ProfileSetupScreen(): React.JSX.Element {
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <Text style={{ color: colors.text, fontSize: type.xl, fontWeight: '700' }}>Set up</Text>
      <ProfileForm
        submitLabel="Save and start"
        onSubmit={(v) =>
          saveChild({
            display_name: v.display_name,
            birth_year: v.birth_year,
            medications_note: v.medications_note,
          })
        }
      />
      <SectionTitle>Intensity guide</SectionTitle>
      <Card>
        {INTENSITIES.map((i) => (
          <View key={i} style={{ gap: spacing.xs }}>
            <IntensityBadge intensity={i} />
            <Text style={{ color: colors.text, fontSize: type.md }}>{DEFAULT_INTENSITY_GUIDE[i]}</Text>
          </View>
        ))}
        <Muted>These are suggested definitions. Review them with the doctor — you can edit them in Settings.</Muted>
      </Card>
    </Screen>
  );
}
