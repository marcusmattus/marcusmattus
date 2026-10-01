import { StyleSheet, Text, TextProps } from 'react-native';
import { colors, fontFamilies } from '@/theme/tokens';

type MonoLabelProps = TextProps & {
  tint?: string;
  size?: number;
};

export function MonoLabel({ tint, size = 10, style, children, ...rest }: MonoLabelProps) {
  return (
    <Text style={[styles.base, { color: tint ?? colors.fgLabel, fontSize: size }, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fontFamilies.mono,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
