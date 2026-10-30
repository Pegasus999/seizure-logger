import React, { useState } from 'react';
import { Text, View } from 'react-native';

import type { Child } from '../types';
import { Button, TextField } from './ui';
import { colors, spacing, type } from '../theme';

export interface ProfileValues {
  display_name: string;
  birth_year: number | null;
  medications_note: string | null;
}

/** Reusable profile form (no last-visit date; ProfileEdit may add it around this). */
export function ProfileForm({
  initial,
  submitLabel = 'Save',
  onSubmit,
}: {
  initial?: Pick<Child, 'display_name' | 'birth_year' | 'medications_note'> | null;
  submitLabel?: string;
  onSubmit: (values: ProfileValues) => void;
}): React.JSX.Element {
  const [name, setName] = useState(initial?.display_name ?? '');
  const [year, setYear] = useState(initial?.birth_year ? String(initial.birth_year) : '');
  const [meds, setMeds] = useState(initial?.medications_note ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const n = name.trim();
    if (!n) {
      setError('Please enter a name or initials.');
      return;
    }
    let birth: number | null = null;
    if (year.trim()) {
      const y = Number(year.trim());
      const max = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1990 || y > max) {
        setError(`Birth year must be between 1990 and ${max}.`);
        return;
      }
      birth = y;
    }
    setError(null);
    onSubmit({ display_name: n, birth_year: birth, medications_note: meds.trim() || null });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label="Display name"
        hint="First name or initials is enough"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextField
        label="Birth year (optional)"
        value={year}
        onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
      />
      <TextField
        label="Medications note (optional)"
        value={meds}
        onChangeText={setMeds}
        multiline
      />
      {error ? <Text style={{ color: colors.danger, fontSize: type.md }}>{error}</Text> : null}
      <Button label={submitLabel} size="lg" onPress={submit} />
    </View>
  );
}
