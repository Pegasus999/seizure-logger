import React from 'react';
import { Text } from 'react-native';

import { Screen } from '../components/ui';
import { colors } from '../theme';

export default function IntensityGuideScreen(): React.JSX.Element {
  return (
    <Screen>
      <Text style={{ color: colors.textDim }}>IntensityGuide coming soon</Text>
    </Screen>
  );
}
