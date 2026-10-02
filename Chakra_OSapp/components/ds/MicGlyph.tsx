import Svg, { Path } from 'react-native-svg';

// The spec's v1 rule: no icon-library glyphs except the mic, drawn as two
// hairline arcs (never an icon-font/emoji mic).
export function MicGlyph({ size = 14, color = '#8A90A6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 10a4 4 0 0 0 8 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M5 9a7 7 0 0 0 14 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
