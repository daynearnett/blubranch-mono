import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Briefcase, Home, Plus, User, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../hooks/useLayout.js';
import { colors, radius, spacing, typography } from '../theme.js';

const TAB_ICONS: Record<string, LucideIcon> = {
  feed: Home,
  network: Users,
  post: Plus,
  jobs: Briefcase,
  profile: User,
};

const TAB_LABELS: Record<string, string> = {
  feed: 'Feed',
  network: 'Network',
  post: 'Post',
  jobs: 'Jobs',
  profile: 'Me',
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
          const Icon = TAB_ICONS[route.name] ?? Home;
          const label = TAB_LABELS[route.name] ?? route.name;
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
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
            >
              {isPost ? (
                <View style={styles.postFab}>
                  <Plus color={colors.textInverse} size={28} strokeWidth={1.8} />
                </View>
              ) : (
                <>
                  <Icon
                    color={focused ? colors.navy : colors.textMuted}
                    size={22}
                    strokeWidth={1.8}
                  />
                  <Text style={[styles.bottomLabel, focused && styles.bottomLabelActive]}>
                    {label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

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
        const Icon = TAB_ICONS[route.name] ?? Home;
        const label = TAB_LABELS[route.name] ?? route.name;
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
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
          >
            <Icon
              color={focused ? colors.navy : colors.textMuted}
              size={22}
              strokeWidth={1.8}
            />
            {isDesktop ? (
              <Text style={[styles.sideLabel, focused && styles.sideLabelActive]}>{label}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.sm,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxs,
  },
  bottomItemPost: { marginTop: -spacing.xl },
  bottomLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  bottomLabelActive: { color: colors.navy, fontWeight: '600' },
  postFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.steel,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  sidebar: {
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.xxs,
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
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLogoText: { color: colors.navy, fontWeight: '700' },
  sidebarBrandText: { ...typography.h3, color: colors.navy },
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
  sideLabel: { ...typography.body, color: colors.textPrimary },
  sideLabelActive: { color: colors.navy, fontWeight: '600' },
});
