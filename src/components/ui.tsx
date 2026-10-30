import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '../theme';

export function Screen({
  children,
  scroll,
  edges,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges ?? ['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle ?? styles.pad]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  busy,
  busyLabel,
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceAlt
          : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? colors.bg : colors.text;
  const off = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLg,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? colors.border : bg,
          opacity: off ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.buttonText, size === 'lg' && styles.buttonTextLg, { color: fg }]}>
        {busy ? (busyLabel ?? `${label}…`) : label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const borderColor = selected ? (color ?? colors.accent) : colors.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { borderColor, backgroundColor: selected ? colors.surfaceAlt : colors.surface, opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.chipText, selected && { color: color ?? colors.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <View style={[styles.chipGroup, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<import('react-native').TextStyle>;
}): React.JSX.Element {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Row({
  label,
  value,
  onPress,
  right,
  style,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const content = (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      {value !== undefined ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {content}
    </Pressable>
  );
}

export function TextField({
  label,
  hint,
  style,
  inputStyle,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<import('react-native').TextStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        keyboardAppearance="dark"
        selectionColor={colors.accent}
        {...props}
        style={[styles.input, props.multiline && styles.inputMulti, inputStyle]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({
  label,
  value,
  onValueChange,
  description,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  description?: string;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.fill}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  pad: { padding: spacing.lg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLg: { minHeight: 56 },
  buttonText: { fontSize: type.md, fontWeight: '600' },
  buttonTextLg: { fontSize: type.lg },
  chip: {
    minHeight: 48,
    borderRadius: radius,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: { color: colors.text, fontSize: type.md },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: {
    color: colors.textDim,
    fontSize: type.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  muted: { color: colors.textDim, fontSize: type.sm },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowLabel: { color: colors.text, fontSize: type.md, flexShrink: 1 },
  rowValue: { color: colors.textDim, fontSize: type.md, marginLeft: 'auto' },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: type.sm, fontWeight: '600' },
  input: {
    minHeight: 48,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: type.md,
  },
  inputMulti: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  hint: { color: colors.textDim, fontSize: type.sm },
});
