import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../theme.js';

type BadgeSize = 'mini' | 'small' | 'large';

const SIZES: Record<BadgeSize, { outer: number; icon: number; stroke: number }> = {
  mini: { outer: 12, icon: 7, stroke: 2.5 },
  small: { outer: 18, icon: 10, stroke: 2.5 },
  large: { outer: 26, icon: 14, stroke: 2.5 },
};

interface VerifiedBadgeProps {
  size?: BadgeSize;
}

export function VerifiedBadge({ size = 'small' }: VerifiedBadgeProps) {
  const s = SIZES[size];
  return (
    <View
      style={[styles.circle, { width: s.outer, height: s.outer, borderRadius: s.outer / 2 }]}
      accessibilityLabel="Verified"
      accessibilityRole="image"
    >
      <Check color={colors.textInverse} size={s.icon} strokeWidth={s.stroke} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
