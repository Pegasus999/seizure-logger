import React, { useState } from 'react';

import { DateField } from '../components/DateField';
import { ProfileForm } from '../components/ProfileForm';
import { Card, Screen } from '../components/ui';
import { getActiveChild, saveChild } from '../db/repo';
import { dayKey, parseLocalDate } from '../lib/dates';
import type { RootScreenProps } from '../navigation/types';
import { spacing } from '../theme';
import { View } from 'react-native';

export default function ProfileEditScreen({ navigation }: RootScreenProps<'ProfileEdit'>): React.JSX.Element {
  const [child] = useState(() => getActiveChild());
  const [visit, setVisit] = useState<Date | null>(() =>
    child?.last_visit_date ? parseLocalDate(child.last_visit_date) : null,
  );

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <Card>
          <DateField label="Last doctor visit" value={visit} onChange={setVisit} allowClear />
        </Card>
        <ProfileForm
          initial={child}
          onSubmit={(values) => {
            saveChild({
              ...(child ? { id: child.id } : {}),
              ...values,
              intensity_guide: child?.intensity_guide ?? null,
              last_visit_date: visit ? dayKey(visit) : null,
            });
            navigation.goBack();
          }}
        />
      </View>
    </Screen>
  );
}
