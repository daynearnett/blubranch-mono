// Tab 2 — Network. Placeholder until Chunk 5 builds the full network screens.
import { StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { TopSearchBar } from '../../../src/components/top-search-bar.js';
import { colors, spacing, typography } from '../../../src/theme.js';

export default function NetworkTab() {
  return (
    <View style={styles.root}>
      <TopSearchBar placeholder="Search people..." />
      <View style={styles.center}>
        <Users color={colors.textMuted} size={40} strokeWidth={1.5} />
        <Text style={styles.title}>Network</Text>
        <Text style={styles.body}>
          Find and connect with verified tradespeople, manage your connections, and discover people you may know.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: { ...typography.h3, color: colors.navy, marginTop: spacing.md },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
