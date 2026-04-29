import { Tabs } from 'expo-router';
import { ResponsiveTabBar } from '../../../src/components/responsive-tab-bar.js';
import { useLayout } from '../../../src/hooks/useLayout.js';

export default function TabsLayout() {
  const { isMobile } = useLayout();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // bottom-tabs v7 supports `tabBarPosition`; expo-router 4.x uses v7.
        // Setting it here makes the navigator wrap its container in a row
        // (sidebar) or column (bottom-bar) flexbox automatically.
        tabBarPosition: isMobile ? 'bottom' : 'left',
      }}
      tabBar={(props) => <ResponsiveTabBar {...props} />}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="finances" options={{ title: 'Finances' }} />
      <Tabs.Screen name="post" options={{ title: 'Post' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
