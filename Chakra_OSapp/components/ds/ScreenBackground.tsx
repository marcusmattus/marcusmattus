import { StyleSheet, View, ViewProps } from 'react-native';
import { colors } from '@/theme/tokens';

// bg-page with a faint cyan glow near the top, per design system README "Surface".
export function ScreenBackground({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.page, style]} {...rest}>
      <View pointerEvents="none" style={styles.glow} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  glow: {
    position: 'absolute',
    top: -260,
    left: '50%',
    marginLeft: -300,
    width: 600,
    height: 500,
    borderRadius: 300,
    backgroundColor: 'rgba(54,214,231,0.06)',
  },
});
