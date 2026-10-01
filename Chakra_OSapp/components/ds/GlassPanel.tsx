import { BlurView } from 'expo-blur';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radii } from '@/theme/tokens';

type GlassPanelProps = ViewProps & {
  strong?: boolean;
  radius?: number;
  tint?: string;
  // Layout (flexDirection, alignItems, gap, ...) for the content wrapper —
  // `style` alone only reaches the outer (absolutely-positioned) wrapper.
  contentStyle?: ViewProps['style'];
};

export function GlassPanel({ strong, radius = radii.r4, tint, style, contentStyle, children, ...rest }: GlassPanelProps) {
  return (
    <View style={[styles.wrap, { borderRadius: radius, borderColor: tint ? withAlpha(tint, 0.35) : colors.border1 }, style]} {...rest}>
      <BlurView intensity={strong ? 40 : 24} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? colors.bgGlassStrong : colors.bgGlass, borderRadius: radius },
        ]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
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
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  content: {
    padding: 16,
  },
});
