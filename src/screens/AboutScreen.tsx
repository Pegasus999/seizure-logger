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
      <Text style={{ color: colors.text, fontSize: type.xl, fontWeight: '700' }}>Seizure Log</Text>
      <Muted>Version {version}</Muted>

      <Card style={{ borderColor: colors.danger }}>
        <SectionTitle>Important</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.lg, lineHeight: 28 }}>{EMERGENCY_DISCLAIMER}</Text>
      </Card>

      <Card>
        <SectionTitle>Privacy</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.md, lineHeight: 24 }}>{PRIVACY_NOTE}</Text>
      </Card>

      <Card>
        <SectionTitle>What this app is</SectionTitle>
        <Text style={{ color: colors.text, fontSize: type.md, lineHeight: 24 }}>
          Seizure Log is not a medical device. It records what you observe and makes a report for the doctor.
        </Text>
      </Card>
    </Screen>
  );
}
