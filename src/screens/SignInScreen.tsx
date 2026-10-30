import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, ChipGroup, Muted, Screen, TextField } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { EMERGENCY_DISCLAIMER } from '../constants';
import { colors, spacing, type } from '../theme';

type Mode = 'password' | 'code';

export default function SignInScreen(): React.JSX.Element {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (name: string, fn: () => Promise<{ error?: string }>, onOk?: () => void) => {
    setBusy(name);
    setMessage(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setMessage(r.error);
    else onOk?.();
  };

  const trimmed = email.trim();

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Text style={{ color: colors.text, fontSize: type.xl, fontWeight: '700' }}>Seizure Log</Text>
        <Text style={{ color: colors.textDim, fontSize: type.md }}>
          Quickly log night-time seizures and share a clear report with your doctor.
        </Text>
      </View>

      <ChipGroup>
        <Chip label="Password" selected={mode === 'password'} onPress={() => { setMode('password'); setMessage(null); }} />
        <Chip label="Email code" selected={mode === 'code'} onPress={() => { setMode('code'); setMessage(null); }} />
      </ChipGroup>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />

      {mode === 'password' ? (
        <View style={{ gap: spacing.md }}>
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
          />
          <Button
            label="Sign in"
            size="lg"
            busy={busy === 'signin'}
            busyLabel="Signing in…"
            disabled={!trimmed || !password || !!busy}
            onPress={() => run('signin', () => auth.signInWithPassword(trimmed, password))}
          />
          <Button
            label="Create account"
            variant="secondary"
            busy={busy === 'signup'}
            busyLabel="Creating…"
            disabled={!trimmed || password.length < 6 || !!busy}
            onPress={() => run('signup', () => auth.signUp(trimmed, password))}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <Button
            label={codeSent ? 'Send code again' : 'Send code'}
            variant={codeSent ? 'secondary' : 'primary'}
            size="lg"
            busy={busy === 'send'}
            busyLabel="Sending…"
            disabled={!trimmed || !!busy}
            onPress={() =>
              run('send', () => auth.sendCode(trimmed), () => {
                setCodeSent(true);
                setMessage('Code sent. Check your email.');
              })
            }
          />
          {codeSent ? (
            <>
              <TextField
                label="6-digit code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
              />
              <Button
                label="Verify"
                size="lg"
                busy={busy === 'verify'}
                busyLabel="Verifying…"
                disabled={code.length !== 6 || !!busy}
                onPress={() => run('verify', () => auth.verifyCode(trimmed, code))}
              />
            </>
          ) : null}
        </View>
      )}

      {message ? <Text style={{ color: colors.text, fontSize: type.md }}>{message}</Text> : null}

      <Muted style={{ marginTop: spacing.xl }}>{EMERGENCY_DISCLAIMER}</Muted>
    </Screen>
  );
}
