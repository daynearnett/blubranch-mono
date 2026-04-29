// One tab bar component, three layouts:
//   mobile  → 5-icon row across the bottom, Post button raised orange
//   tablet  → vertical rail on the left, icons only (collapsed)
//   desktop → vertical rail on the left, icons + labels (expanded)
//
// We pass this to <Tabs tabBar={...}> from expo-router. The navigator
// container's flexDirection is controlled via screenOptions.tabBarPosition,
// so this component just owns its own appearance.
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout.js';
import { colors, radius, spacing, typography } from '../theme.js';

const ICONS: Record<string, string> = {
  feed: '🏠',
  finances: '💰',
  post: '+',
  jobs: '💼',
  profile: '👤',
};

export function ResponsiveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isMobile, isDesktop } = useLayout();
  const insets = useSafeAreaInsets();

  if (isMobile) {
    return (
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const isPost = route.name === 'post';
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.bottomItem, isPost && styles.bottomItemPost]}
              accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
            >
              {isPost ? (
                <View style={styles.postFab}>
                  <Text style={styles.postFabIcon}>+</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.bottomIcon, focused && styles.bottomIconActive]}>
                    {ICONS[route.name] ?? '·'}
                  </Text>
                  <Text style={[styles.bottomLabel, focused && styles.bottomLabelActive]}>
                    {descriptors[route.key]?.options.title ?? route.name}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

  // Sidebar (tablet collapsed / desktop expanded)
  return (
    <View
      style={[
        styles.sidebar,
        isDesktop ? styles.sidebarExpanded : styles.sidebarCollapsed,
        { paddingTop: insets.top + spacing.md },
      ]}
    >
      <View style={styles.sidebarBrand}>
        <View style={styles.sidebarLogo}>
          <Text style={styles.sidebarLogoText}>BB</Text>
        </View>
        {isDesktop ? <Text style={styles.sidebarBrandText}>BluBranch</Text> : null}
      </View>

      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={[
              styles.sideItem,
              isDesktop ? styles.sideItemExpanded : styles.sideItemCollapsed,
              focused && styles.sideItemActive,
            ]}
            accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
          >
            <Text style={[styles.sideIcon, focused && styles.sideIconActive]}>
              {ICONS[route.name] ?? '·'}
            </Text>
            {isDesktop ? (
              <Text style={[styles.sideLabel, focused && styles.sideLabelActive]}>
                {descriptors[route.key]?.options.title ?? route.name}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Mobile bottom bar ────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  bottomItemPost: { marginTop: -spacing.xl },
  bottomIcon: { fontSize: 22, color: colors.textSecondary },
  bottomIconActive: { color: colors.primary },
  bottomLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  bottomLabelActive: { color: colors.primary, fontWeight: '600' },
  postFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  postFabIcon: { color: colors.textInverse, fontSize: 28, fontWeight: '300', lineHeight: 32 },

  // ── Sidebar (tablet + desktop) ───────────────────────────────
  sidebar: {
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  sidebarCollapsed: { width: 72, alignItems: 'center' },
  sidebarExpanded: { width: 240 },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  sidebarLogo: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLogoText: { color: colors.textInverse, fontWeight: '700' },
  sidebarBrandText: { ...typography.h3, color: colors.primaryDark },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
  },
  sideItemCollapsed: {
    width: 48,
    height: 48,
    justifyContent: 'center',
  },
  sideItemExpanded: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sideItemActive: { backgroundColor: colors.chipBgActive },
  sideIcon: { fontSize: 22, color: colors.textSecondary },
  sideIconActive: { color: colors.primary },
  sideLabel: { ...typography.body, color: colors.textPrimary },
  sideLabelActive: { color: colors.primary, fontWeight: '600' },
});
