import Constants from 'expo-constants';
import React from 'react';
import { Text } from 'react-native';

import { Card, Muted, Screen, SectionTitle } from '../components/ui';
import { EMERGENCY_DISCLAIMER, PRIVACY_NOTE } from '../constants';
import { colors, type } from '../theme';

export default function AboutScreen(): React.JSX.Element {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: type.xl, fontWeight: '700' }}>Journal des crises</Text>
      <Muted>Version {version}</Muted>

      <Card style={{ borderColor: colors.danger }}>
        <SectionTitle>Avertissement</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.lg, lineHeight: 28 }}>{EMERGENCY_DISCLAIMER}</Text>
      </Card>

      <Card>
        <SectionTitle>Confidentialité</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.md, lineHeight: 24 }}>{PRIVACY_NOTE}</Text>
      </Card>

      <Card>
        <SectionTitle>Ce qu'est cette application</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.md, lineHeight: 24 }}>
          Cette application n'est pas un dispositif médical. Elle note ce que vous observez et prépare un rapport pour le médecin.
        </Text>
      </Card>
    </Screen>
  );
}
