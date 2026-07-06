import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ListRenderItemInfo, ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HardHat, Shield, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from '../../src/components/ui.js';
import { SocialAuthButtons } from '../../src/components/social-auth-buttons.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: Users,
    title: 'Build your professional network',
    subtitle: 'Connect with verified tradespeople, get endorsements, and grow your reputation.',
  },
  {
    id: '2',
    icon: HardHat,
    title: 'Find work that fits your skills',
    subtitle: 'Browse jobs matched to your trade, experience, and location. Apply with one tap.',
  },
  {
    id: '3',
    icon: Shield,
    title: 'Verified and trusted',
    subtitle: 'License verification, workplace confirmation, and a community built on trust.',
  },
];

const AUTO_ADVANCE_MS = 4000;

export default function Welcome() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && first.index != null) {
        setActiveIndex(first.index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  useEffect(() => {
    autoTimer.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => {
      if (autoTimer.current) clearInterval(autoTimer.current);
    };
  }, []);

  const stopAutoAdvance = () => {
    if (autoTimer.current) {
      clearInterval(autoTimer.current);
      autoTimer.current = null;
    }
  };

  const renderSlide = ({ item }: ListRenderItemInfo<Slide>) => {
    const Icon = item.icon;
    return (
      <View style={styles.slide}>
        <View style={styles.iconCircle}>
          <Icon color={colors.textInverse} size={40} strokeWidth={1.5} />
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <View style={styles.logoBlock}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brand}>BluBranch</Text>
          </View>

          <FlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={renderSlide}
            keyExtractor={(s) => s.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollBeginDrag={stopAutoAdvance}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Create a free account"
            onPress={() => router.push('/(auth)/signup-name')}
          />

          <SocialAuthButtons />

          <Pressable
            style={styles.loginBtn}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginLabel}>Already have an account? <Text style={styles.loginLink}>Log in</Text></Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to BluBranch's{' '}
            <Link href="/legal/terms" style={styles.link}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/legal/privacy" style={styles.link}>Privacy Policy</Link>.{' '}
            <Text style={styles.legalBold}>Workers always free.</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  topSection: { flex: 1 },
  logoBlock: { alignItems: 'center', paddingTop: spacing.xxl },
  logoImage: { width: 72, height: 72, borderRadius: radius.lg, marginBottom: spacing.sm },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoMarkText: { fontSize: 24, fontWeight: '700', color: colors.textInverse },
  brand: { ...typography.h1, color: colors.navy, marginBottom: spacing.lg },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  slideTitle: {
    ...typography.h2,
    color: colors.navy,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: colors.orange, width: 24 },
  actions: {
    paddingHorizontal: spacing.xl,
  },
  loginBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loginLabel: { ...typography.body, color: colors.textMuted },
  loginLink: { color: colors.orange, fontWeight: '600' },
  legal: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  legalBold: { fontWeight: '700', color: colors.orange },
  link: { textDecorationLine: 'underline', color: colors.textMuted },
});
