import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamilies, radii } from '@/theme/tokens';

type ChipProps = {
  children: string;
  color?: string;
  active?: boolean;
  dot?: boolean;
};

export function Chip({ children, color = colors.coAccent, active, dot }: ChipProps) {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: active ? withAlpha(color, 0.45) : colors.border1,
          backgroundColor: active ? withAlpha(color, 0.14) : 'transparent',
        },
      ]}>
      {dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.label, { color: active ? color : colors.fg2 }]}>{children}</Text>
    </View>
  );
}

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.r1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fontFamilies.mono,
    fontSize: 10.5,
    letterSpacing: 1,
  },
});
