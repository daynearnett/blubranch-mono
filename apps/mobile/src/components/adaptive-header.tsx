// App header bar — minimal on mobile, expanded with search + actions
// on tablet/desktop. Used by feed-style screens.
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLayout } from '../hooks/useLayout.js';
import { colors, radius, spacing, typography } from '../theme.js';

interface AdaptiveHeaderProps {
  title?: string;
  showSearch?: boolean;
  onSearchChange?: (q: string) => void;
  /** Right-side action icons (mobile shows them all, desktop labels some) */
  actions?: HeaderAction[];
}

interface HeaderAction {
  icon: string;
  label: string;
  onPress?: () => void;
  badgeCount?: number;
}

export function AdaptiveHeader({
  title = 'BluBranch',
  showSearch,
  onSearchChange,
  actions = [],
}: AdaptiveHeaderProps) {
  const { isMobile, isTablet, isDesktop } = useLayout();

  return (
    <View style={[styles.header, !isMobile && styles.headerWide]}>
      <View style={styles.brandRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>BB</Text>
        </View>
        {!isMobile ? <Text style={styles.brand}>{title}</Text> : null}
      </View>

      {showSearch && !isMobile ? (
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Trade, keyword, or company..."
            placeholderTextColor={colors.textSecondary}
            onChangeText={onSearchChange}
            style={styles.searchInput}
          />
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {actions.map((a, i) => (
          <Pressable key={i} onPress={a.onPress} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>{a.icon}</Text>
            {(isTablet || isDesktop) && a.label ? (
              <Text style={styles.actionLabel}>{a.label}</Text>
            ) : null}
            {a.badgeCount ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{a.badgeCount > 9 ? '9+' : a.badgeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerWide: {
    paddingHorizontal: spacing.xl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: { ...typography.bodyBold, color: colors.textInverse, fontSize: 14 },
  brand: { ...typography.h3, color: colors.primaryDark },
  searchWrap: {
    flex: 1,
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 40,
    justifyContent: 'center',
  },
  searchInput: { color: colors.textPrimary, fontSize: typography.body.fontSize },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 'auto',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    position: 'relative',
  },
  actionIcon: { fontSize: 18 },
  actionLabel: { ...typography.small, color: colors.textPrimary },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 9, color: colors.textInverse, fontWeight: '700' },
});
