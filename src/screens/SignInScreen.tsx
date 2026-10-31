import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Muted, Screen, TextField } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { EMERGENCY_DISCLAIMER } from '../constants';
import { colors, spacing, type } from '../theme';

const MIN_PASSWORD = 6;

export default function SignInScreen(): React.JSX.Element {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (name: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(name);
    setMessage(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setMessage(r.error);
  };

  const trimmed = email.trim();
  const shortPassword = password.length > 0 && password.length < MIN_PASSWORD;

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Text style={{ color: colors.text, fontSize: type.xl, fontWeight: '700' }}>Journal des crises</Text>
        <Text style={{ color: colors.textDim, fontSize: type.md }}>
          Notez rapidement les crises nocturnes et partagez un rapport clair avec votre médecin.
        </Text>
      </View>

      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />

      <View style={{ gap: spacing.md }}>
        <TextField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
        />
        <Muted>
          {shortPassword
            ? `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`
            : `Première visite ? Saisissez votre e-mail et un mot de passe d'au moins ${MIN_PASSWORD} caractères, puis touchez « Créer un compte ».`}
        </Muted>
        <Button
          label="Connexion"
          size="lg"
          busy={busy === 'signin'}
          busyLabel="Connexion…"
          disabled={!trimmed || !password || !!busy}
          onPress={() => run('signin', () => auth.signInWithPassword(trimmed, password))}
        />
        <Button
          label="Créer un compte"
          variant="secondary"
          busy={busy === 'signup'}
          busyLabel="Création…"
          disabled={!trimmed || password.length < MIN_PASSWORD || !!busy}
          onPress={() => run('signup', () => auth.signUp(trimmed, password))}
        />
      </View>

      {message ? <Text style={{ color: colors.text, fontSize: type.md }}>{message}</Text> : null}

      <Muted style={{ marginTop: spacing.xl }}>{EMERGENCY_DISCLAIMER}</Muted>
    </Screen>
  );
}
