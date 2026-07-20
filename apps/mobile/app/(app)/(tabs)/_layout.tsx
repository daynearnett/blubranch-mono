import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationEventMap,
  type MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { Tabs, withLayoutContext } from 'expo-router';
import { ResponsiveTabBar } from '../../../src/components/responsive-tab-bar.js';
import { useLayout } from '../../../src/hooks/useLayout.js';

// Mobile uses material-top-tabs (pager-view) so tabs can be swiped between
// Instagram-style; its bar renders at the bottom via our ResponsiveTabBar.
// Nested horizontal scrollables (photo carousels, filter pill rows) claim
// their gestures before the pager, so swiping a carousel never changes tabs.
const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

// ResponsiveTabBar only touches state/descriptors/navigation, which the two
// navigators share; the cast bridges the prop types.
const renderBar = (props: unknown) => <ResponsiveTabBar {...(props as BottomTabBarProps)} />;

export default function TabsLayout() {
  const { isMobile } = useLayout();

  if (isMobile) {
    return (
      <MaterialTopTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          // Mount screens on first visit, preload neighbors so a swipe never
          // lands on a blank page.
          lazy: true,
          lazyPreloadDistance: 1,
        }}
        tabBar={renderBar}
      >
        <MaterialTopTabs.Screen name="feed" options={{ title: 'Feed' }} />
        <MaterialTopTabs.Screen name="network" options={{ title: 'Network' }} />
        <MaterialTopTabs.Screen name="post" options={{ title: 'Post' }} />
        <MaterialTopTabs.Screen name="jobs" options={{ title: 'Jobs' }} />
        <MaterialTopTabs.Screen name="profile" options={{ title: 'My Branch' }} />
      </MaterialTopTabs>
    );
  }

  // Tablet/desktop keep the bottom-tabs navigator: no swipe gesture on large
  // layouts, and `tabBarPosition: 'left'` provides the sidebar arrangement.
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarPosition: 'left' }}
      tabBar={renderBar}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="network" options={{ title: 'Network' }} />
      <Tabs.Screen name="post" options={{ title: 'Post' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="profile" options={{ title: 'My Branch' }} />
    </Tabs>
  );
}
