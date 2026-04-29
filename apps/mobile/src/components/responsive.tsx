// Responsive layout primitives. Read from useLayout() so they
// reflow automatically when the window is resized.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useLayout } from '../hooks/useLayout.js';
import { colors, radius, spacing } from '../theme.js';

// ── ResponsiveContainer ────────────────────────────────────────
// Constrains content to readable widths on tablet/desktop while
// keeping mobile full-bleed. Mirrors the pattern used by LinkedIn /
// Twitter / GitHub for their main column.
export function ResponsiveContainer({
  children,
  style,
  maxWidth,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}) {
  const { isMobile, isTablet, isDesktop } = useLayout();
  const cap = maxWidth ?? (isDesktop ? 880 : isTablet ? 720 : undefined);
  return (
    <View style={[styles.containerOuter, isMobile && styles.containerMobile, style]}>
      <View
        style={[
          styles.containerInner,
          cap ? { maxWidth: cap, width: '100%' } : null,
          !isMobile && styles.containerWide,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ── ResponsiveGrid ─────────────────────────────────────────────
// 1 / 2 / 3 columns by breakpoint. Uses flex wrapping so children
// only need to set width via the rendered child wrapper.
export function ResponsiveGrid({
  children,
  gap = spacing.md,
  columns: forceColumns,
  style,
}: {
  children: ReactNode;
  gap?: number;
  /** Override the auto-computed column count */
  columns?: 1 | 2 | 3;
  style?: StyleProp<ViewStyle>;
}) {
  const { columns: layoutColumns } = useLayout();
  const columns = forceColumns ?? layoutColumns;
  const items = Array.isArray(children) ? children : [children];
  const widthPercent = `${100 / columns}%` as const;

  return (
    <View style={[styles.grid, { marginHorizontal: -gap / 2 }, style]}>
      {items.map((child, i) => (
        <View
          key={i}
          style={{
            width: widthPercent,
            paddingHorizontal: gap / 2,
            marginBottom: gap,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

// ── ResponsiveCard ─────────────────────────────────────────────
// Adjusts padding + radius per breakpoint. Mobile = compact card,
// tablet/desktop = roomier card with hover shadow.
export function ResponsiveCard({
  children,
  style,
  raised,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  const { isMobile, isDesktop } = useLayout();
  const padding = isDesktop ? spacing.xl : isMobile ? spacing.md : spacing.lg;
  return (
    <View
      style={[
        styles.card,
        { padding, borderRadius: isMobile ? radius.md : radius.lg },
        raised && styles.cardRaised,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  containerOuter: { flex: 1, alignItems: 'center', backgroundColor: colors.background },
  containerMobile: { backgroundColor: colors.background },
  containerInner: { flex: 1, width: '100%' },
  containerWide: {
    paddingHorizontal: spacing.xl,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardRaised: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
