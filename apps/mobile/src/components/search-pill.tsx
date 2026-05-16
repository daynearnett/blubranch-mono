import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme.js';

interface SearchPillProps extends Omit<TextInputProps, 'style'> {
  onClear?: () => void;
}

export function SearchPill({ value, onClear, ...rest }: SearchPillProps) {
  const hasValue = value && value.length > 0;
  return (
    <View style={styles.container}>
      <Search color={colors.textMuted} size={16} strokeWidth={2} />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        value={value}
        {...rest}
      />
      {hasValue && onClear && (
        <Pressable onPress={onClear} accessibilityLabel="Clear search" style={styles.clearBtn}>
          <X color={colors.textMuted} size={16} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
});
