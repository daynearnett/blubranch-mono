import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme.js';

interface ProgressBarProps {
  progress: number; // 0–100
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ progress, style }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${clamped}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(15,45,82,0.12)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: colors.orange,
    borderRadius: 1.5,
  },
});
