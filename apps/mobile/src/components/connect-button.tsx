import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme.js';

interface ConnectButtonProps {
  onPress?: () => void;
  pending?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ConnectButton({ onPress, pending, style }: ConnectButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={({ pressed }) => [
        styles.button,
        pending && styles.buttonPending,
        pressed && !pending && styles.buttonPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={pending ? 'Pending connection' : 'Connect'}
    >
      <Text style={[styles.label, pending && styles.labelPending]}>
        {pending ? 'Pending' : 'Connect'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.navy,
    backgroundColor: colors.background,
  },
  buttonPending: {
    borderColor: colors.textMuted,
    opacity: 0.6,
  },
  buttonPressed: {
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
  },
  labelPending: {
    color: colors.textMuted,
  },
});
