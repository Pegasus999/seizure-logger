import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { UNDO_WINDOW_MS } from '../constants';
import { colors, radius, spacing, type } from '../theme';

export interface ToastData {
  key: string | number;
  message: string;
  onUndo?: () => void;
  onDetails?: () => void;
  /** Auto-hide delay; defaults to UNDO_WINDOW_MS. */
  durationMs?: number;
}

/** Render inside a relatively positioned parent; sits at the bottom. Parent clears `toast` via onHide. */
export function UndoToast({
  toast,
  onHide,
  bottom = spacing.lg,
}: {
  toast: ToastData | null;
  onHide: () => void;
  bottom?: number;
}): React.JSX.Element | null {
  const progress = useRef(new Animated.Value(1)).current;
  const hideRef = useRef(onHide);
  hideRef.current = onHide;

  useEffect(() => {
    if (!toast) return;
    const ms = toast.durationMs ?? UNDO_WINDOW_MS;
    progress.setValue(1);
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: ms,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    const t = setTimeout(() => hideRef.current(), ms);
    return () => {
      clearTimeout(t);
      anim.stop();
    };
  }, [toast, progress]);

  if (!toast) return null;
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={styles.toast}>
        <View style={styles.body}>
          <Text style={styles.msg} numberOfLines={2}>
            {toast.message}
          </Text>
          {toast.onUndo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              hitSlop={8}
              style={styles.action}
              onPress={() => {
                onHide();
                toast.onUndo?.();
              }}
            >
              <Text style={styles.actionText}>Annuler</Text>
            </Pressable>
          ) : null}
          {toast.onDetails ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter des détails"
              hitSlop={8}
              style={styles.action}
              onPress={() => {
                onHide();
                toast.onDetails?.();
              }}
            >
              <Text style={styles.actionText}>Ajouter des détails</Text>
            </Pressable>
          ) : null}
        </View>
        <Animated.View style={[styles.bar, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  toast: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  body: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.sm },
  msg: { flex: 1, color: colors.text, fontSize: type.md, paddingVertical: spacing.md },
  action: { minHeight: 48, minWidth: 48, paddingHorizontal: spacing.sm, justifyContent: 'center' },
  actionText: { color: colors.accent, fontSize: type.md, fontWeight: '600' },
  bar: { height: 3, backgroundColor: colors.accent },
});
