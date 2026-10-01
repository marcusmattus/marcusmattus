import { StyleSheet, Text, TextProps } from 'react-native';
import { colors, fontFamilies } from '@/theme/tokens';

export function VoiceText({ style, children, ...rest }: TextProps) {
  return (
    <Text style={[styles.base, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fontFamilies.journal,
    color: colors.fg1,
    fontSize: 15.5,
    lineHeight: 22,
  },
});
