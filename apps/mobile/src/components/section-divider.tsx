import { StyleSheet, View } from 'react-native';
import { colors, layout } from '../theme.js';

export function SectionDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  divider: {
    height: layout.dividerHeight,
    backgroundColor: colors.divider,
  },
});
