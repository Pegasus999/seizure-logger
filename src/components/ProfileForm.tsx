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
  submitLabel = 'Enregistrer',
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
      setError('Veuillez saisir un prénom ou des initiales.');
      return;
    }
    let birth: number | null = null;
    if (year.trim()) {
      const y = Number(year.trim());
      const max = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1990 || y > max) {
        setError(`L'année de naissance doit être comprise entre 1990 et ${max}.`);
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
        label="Prénom de l'enfant"
        hint="Un prénom ou des initiales suffisent"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextField
        label="Année de naissance (facultatif)"
        value={year}
        onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
      />
      <TextField
        label="Traitement en cours (facultatif)"
        value={meds}
        onChangeText={setMeds}
        multiline
      />
      {error ? <Text style={{ color: colors.danger, fontSize: type.md }}>{error}</Text> : null}
      <Button label={submitLabel} size="lg" onPress={submit} />
    </View>
  );
}
