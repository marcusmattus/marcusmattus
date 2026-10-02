import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';

type NodeBarProps = {
  weight: number; // 0..1
  color: string;
};

// Hairline weight bar — a node's signal strength, never called a "score".
export function NodeBar({ weight, color }: NodeBarProps) {
  const pct = Math.max(0, Math.min(1, weight));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 1,
    backgroundColor: colors.border2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    height: 1,
  },
});
