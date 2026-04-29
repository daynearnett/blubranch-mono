import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  PressableProps,
  StyleProp,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { colors, layout, radius, spacing, typography } from '../theme.js';

// ── Button ────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'ctaDark' | 'outline' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, variant = 'primary', loading, style, ...rest }: ButtonProps) {
  const styles = buttonStyles[variant];
  const disabled = rest.disabled || loading;
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={styles.label.color as string} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const baseBtn: ViewStyle = {
  height: layout.buttonHeight,
  borderRadius: radius.md,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: spacing.lg,
};

const buttonStyles = {
  primary: StyleSheet.create({
    base: { ...baseBtn, backgroundColor: colors.primary },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
    label: { ...typography.bodyBold, color: colors.textInverse },
  }),
  ctaDark: StyleSheet.create({
    base: { ...baseBtn, backgroundColor: colors.ctaDark },
    pressed: { opacity: 0.9 },
    disabled: { opacity: 0.5 },
    label: { ...typography.bodyBold, color: colors.textInverse },
  }),
  outline: StyleSheet.create({
    base: { ...baseBtn, borderWidth: 1, borderColor: colors.inputBorder },
    pressed: { backgroundColor: colors.surface },
    disabled: { opacity: 0.5 },
    label: { ...typography.bodyBold, color: colors.textPrimary },
  }),
  ghost: StyleSheet.create({
    base: { ...baseBtn, height: 36 },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.5 },
    label: { ...typography.body, color: colors.primary },
  }),
} as const;

// ── Input ─────────────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  label?: string;
  helper?: string;
  error?: string;
  highlight?: boolean; // orange border (mockup phone field)
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  helper,
  error,
  highlight,
  containerStyle,
  style,
  ...rest
}: InputProps) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <Text style={inputStyles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        {...rest}
        style={[
          inputStyles.field,
          highlight && inputStyles.fieldHighlight,
          error && inputStyles.fieldError,
          style,
        ]}
      />
      {error ? <Text style={inputStyles.errorText}>{error}</Text> : null}
      {!error && helper ? <Text style={inputStyles.helperText}>{helper}</Text> : null}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  label: {
    ...typography.small,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  field: {
    height: layout.inputHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
  },
  fieldHighlight: { borderColor: colors.primary, borderWidth: 2 },
  fieldError: { borderColor: colors.danger },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  helperText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});

// ── Chip (single + multi-select) ─────────────────────────────────
interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, active, onPress, disabled, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        chipStyles.base,
        active && chipStyles.active,
        pressed && !disabled ? chipStyles.pressed : null,
        disabled ? chipStyles.disabled : null,
        style,
      ]}
    >
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  active: { backgroundColor: colors.chipBgActive, borderColor: colors.chipBorderActive },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: { ...typography.small, color: colors.textPrimary },
  labelActive: { color: colors.primaryDark, fontWeight: '600' },
});

// ── Card ──────────────────────────────────────────────────────────
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
});

// ── ProgressDots ──────────────────────────────────────────────────
export function ProgressDots({ count, current }: { count: number; current: number }) {
  return (
    <View style={dotsStyles.row}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[dotsStyles.dot, i === current && dotsStyles.dotActive]} />
      ))}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: colors.primary, width: 24 },
});

// ── Toggle ────────────────────────────────────────────────────────
export function Toggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[toggleStyles.track, value && toggleStyles.trackOn]}
    >
      <View style={[toggleStyles.thumb, value && toggleStyles.thumbOn]} />
    </Pressable>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
  },
  trackOn: { backgroundColor: colors.primary },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  thumbOn: { transform: [{ translateX: 20 }] },
});

// ── Badge ─────────────────────────────────────────────────────────
export function Badge({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'primary' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const toneStyles = badgeStyles[tone];
  return (
    <View style={[badgeStyles.base, toneStyles.bg, style]}>
      <Text style={[badgeStyles.label, toneStyles.label as StyleProp<TextStyle>]}>{label}</Text>
    </View>
  );
}

const badgeStyles = {
  base: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: spacing.xs,
    alignSelf: 'flex-start',
  } as ViewStyle,
  label: { ...typography.caption, fontWeight: '600' } as TextStyle,
  neutral: StyleSheet.create({
    bg: { backgroundColor: colors.chipBg },
    label: { color: colors.textPrimary },
  }),
  success: StyleSheet.create({
    bg: { backgroundColor: '#DCFCE7' },
    label: { color: '#15803D' },
  }),
  primary: StyleSheet.create({
    bg: { backgroundColor: colors.chipBgActive },
    label: { color: colors.primaryDark },
  }),
  danger: StyleSheet.create({
    bg: { backgroundColor: '#FEE2E2' },
    label: { color: '#B91C1C' },
  }),
};
