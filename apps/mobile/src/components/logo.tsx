import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme.js';

const mark = require('../../assets/icon.png');

/**
 * BluBranch logo mark, optionally with the wordmark. Used in onboarding /
 * auth screen headers so the brand shows throughout the flow.
 */
export function Logo({ size = 32, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <View style={styles.row}>
      <Image
        source={mark}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="contain"
      />
      {showWordmark ? <Text style={styles.wordmark}>BluBranch</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { ...typography.h3, color: colors.navy },
});
