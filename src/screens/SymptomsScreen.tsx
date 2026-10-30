import React from 'react';
import { Text } from 'react-native';

import { Screen } from '../components/ui';
import { colors } from '../theme';

export default function SymptomsScreen(): React.JSX.Element {
  return (
    <Screen>
      <Text style={{ color: colors.textDim }}>Symptoms coming soon</Text>
    </Screen>
  );
}
