// Right-pane on desktop. Reads from DetailPanelContext and renders a job
// detail (or worker profile preview) inline so users don't lose their
// scroll position on the centre column.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { JobDetailBody } from './job-detail-body.js';
import { useDetailPanel } from '../lib/detail-panel-context.js';
import { colors, radius, spacing, typography } from '../theme.js';

export function JobDetailPane({ onClose }: { onClose?: () => void }) {
  const { target } = useDetailPanel();

  return (
    <View style={styles.pane}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Detail</Text>
        {target && onClose ? (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      {!target ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Select a job to see details here.</Text>
        </View>
      ) : target.kind === 'job' ? (
        <ScrollView>
          <JobDetailBody jobId={target.id} />
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Profile preview lands in a later iteration.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    width: 380,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: { ...typography.h3, color: colors.primaryDark },
  close: { fontSize: 18, color: colors.textSecondary, paddingHorizontal: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  scroll: { padding: spacing.lg },
});
