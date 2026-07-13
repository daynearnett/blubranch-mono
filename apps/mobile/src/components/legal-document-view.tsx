import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LegalDocument } from '@blubranch/shared';
import { colors, radius, spacing, typography } from '../theme.js';

/** Renders a shared LegalDocument (Privacy Policy / Terms) as a native screen. */
export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const effective = new Date(doc.effectiveDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.meta}>
          Version {doc.version} · Effective {effective}
        </Text>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>{doc.draftBanner}</Text>
        </View>

        {doc.intro.map((p, i) => (
          <Text key={`intro-${i}`} style={styles.paragraph}>
            {p}
          </Text>
        ))}

        {doc.sections.map((section, si) => (
          <View key={`sec-${si}`}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.body.map((line, li) =>
              line.startsWith('• ') ? (
                <View key={`b-${si}-${li}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line.slice(2)}</Text>
                </View>
              ) : (
                <Text key={`p-${si}-${li}`} style={styles.paragraph}>
                  {line}
                </Text>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.navy },
  meta: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  banner: {
    backgroundColor: '#FFF6D6',
    borderWidth: 1,
    borderColor: '#E8C23A',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { ...typography.small, color: '#5c4a00' },
  heading: { ...typography.h3, color: colors.navy, marginTop: spacing.lg, marginBottom: spacing.xs },
  paragraph: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', marginBottom: spacing.xs, paddingLeft: spacing.xs },
  bulletDot: { ...typography.body, color: colors.textMuted, width: 16 },
  bulletText: { ...typography.body, color: colors.textPrimary, flex: 1, lineHeight: 21 },
});
