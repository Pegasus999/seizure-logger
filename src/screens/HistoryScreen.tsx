import React from 'react';
import { Text } from 'react-native';

import { Screen } from '../components/ui';
import { colors } from '../theme';

export default function HistoryScreen(): React.JSX.Element {
  return (
    <Screen>
      <Text style={{ color: colors.textDim }}>History coming soon</Text>
    </Screen>
  );
}
