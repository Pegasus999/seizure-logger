import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, Card, Muted, Screen, TextField } from '../components/ui';
import { addCustomSymptom, deleteSymptom, listSymptoms } from '../db/repo';
import { useDbChange } from '../db/useDbChange';
import { colors, spacing, type } from '../theme';

export default function SymptomsScreen(): React.JSX.Element {
  const tick = useDbChange();
  const symptoms = useMemo(() => listSymptoms(), [tick]);
  const [label, setLabel] = useState('');

  const add = () => {
    const l = label.trim();
    if (!l) return;
    addCustomSymptom(l);
    setLabel('');
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
        <TextField
          style={{ flex: 1 }}
          label="New symptom"
          value={label}
          onChangeText={setLabel}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Button label="Add" onPress={add} />
      </View>
      <Card>
        {symptoms.map((s) => (
          <View
            key={s.id}
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: spacing.md }}
          >
            <Text style={{ flex: 1, color: colors.text, fontSize: type.md }}>{s.label}</Text>
            {s.is_default ? (
              <Muted>Built-in</Muted>
            ) : (
              <Button
                label="Delete"
                variant="ghost"
                accessibilityLabel={`Delete ${s.label}`}
                onPress={() =>
                  Alert.alert(`Delete "${s.label}"?`, 'It stays on past entries that already use it.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteSymptom(s.id) },
                  ])
                }
              />
            )}
          </View>
        ))}
      </Card>
      <Muted>Deleting a symptom keeps it on past entries.</Muted>
    </Screen>
  );
}
