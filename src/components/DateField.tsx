import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { formatDate } from '../lib/dates';
import { colors, spacing, type } from '../theme';
import { Button } from './ui';

export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  allowClear,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  mode?: 'date';
  allowClear?: boolean;
}): React.JSX.Element {
  const [showIos, setShowIos] = useState(false);
  const current = value ?? new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        onChange: (e, d) => {
          if (e.type === 'set' && d) onChange(d);
        },
      });
    } else {
      setShowIos((v) => !v);
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.text, fontSize: type.sm, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Button
          style={{ flex: 1 }}
          label={value ? formatDate(value) : 'Non renseignée'}
          variant="secondary"
          accessibilityLabel={`${label} : ${value ? formatDate(value) : 'non renseignée'}. Modifier`}
          onPress={open}
        />
        {allowClear && value ? (
          <Button
            label="Effacer"
            variant="ghost"
            onPress={() => {
              setShowIos(false);
              onChange(null);
            }}
          />
        ) : null}
      </View>
      {Platform.OS === 'ios' && showIos ? (
        <DateTimePicker
          value={current}
          mode={mode}
          display="spinner"
          themeVariant="dark"
          onChange={(_e, d) => {
            if (d) onChange(d);
          }}
        />
      ) : null}
    </View>
  );
}
