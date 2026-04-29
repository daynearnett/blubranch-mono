// Used by Phase 2 tab screens whose real content lands in later phases.
// Keeps the visuals consistent and gives the layout something to flex against
// at every breakpoint.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLayout } from '../hooks/useLayout.js';
import { colors, radius, spacing, typography } from '../theme.js';
import { AdaptiveHeader } from './adaptive-header.js';
import { ResponsiveContainer } from './responsive.js';

interface Props {
  title: string;
  comingIn: string;
  body: string;
  icon?: string;
  /** Hide the AdaptiveHeader (e.g. when the screen wants its own header) */
  noHeader?: boolean;
  /** Show the global app header with a search bar */
  showSearch?: boolean;
}

export function Placeholder({ title, comingIn, body, icon, noHeader, showSearch }: Props) {
  const { isDesktop } = useLayout();
  return (
    <View style={styles.root}>
      {!noHeader ? (
        <AdaptiveHeader
          title="BluBranch"
          showSearch={showSearch}
          actions={[
            { icon: '🔔', label: 'Alerts', badgeCount: 0 },
            { icon: '✉️', label: 'Messages' },
          ]}
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.scroll}>
        <ResponsiveContainer>
          <View style={styles.hero}>
            <Text style={styles.icon}>{icon ?? '🏗️'}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.coming}>{comingIn}</Text>
            <Text style={styles.body}>{body}</Text>

            {isDesktop ? (
              <View style={styles.detailHint}>
                <Text style={styles.detailHintText}>
                  ← This area will host filtered feeds, lists, and detail panels at desktop sizes.
                </Text>
              </View>
            ) : null}
          </View>
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingVertical: spacing.xl },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  icon: { fontSize: 48, marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.primaryDark, marginBottom: spacing.sm },
  coming: { ...typography.bodyBold, color: colors.primary, marginBottom: spacing.lg },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 480,
  },
  detailHint: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    maxWidth: 480,
  },
  detailHintText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
