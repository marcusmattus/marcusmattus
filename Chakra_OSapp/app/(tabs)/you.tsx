import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Settings } from 'lucide-react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { GlassPanel } from '@/components/ds/GlassPanel';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { ScreenBackground } from '@/components/ds/ScreenBackground';
import { colors, chakras, fontFamilies, spacing } from '@/theme/tokens';

// Nine points around the nonagon, outermost ring first (Soul) — mirrors the
// field-map polygon used across the design board.
const POLY_POINTS: [number, number][] = [
  [110, 42],
  [158, 58],
  [189, 104],
  [174, 152],
  [137, 182],
  [89, 186],
  [50, 163],
  [32, 120],
  [45, 72],
];

export default function YouScreen() {
  return (
    <ScreenBackground>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <MonoLabel>Profile · Level 07</MonoLabel>
            <Text style={styles.name}>Iris V.</Text>
          </View>
          <View style={styles.settingsButton}>
            <Settings size={15} color={colors.fg2} strokeWidth={1.5} />
          </View>
        </View>

        <View style={styles.polygonWrap}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Circle cx={110} cy={110} r={86} fill="none" stroke={colors.border1} strokeWidth={1} />
            <Polygon
              points={POLY_POINTS.map((p) => p.join(',')).join(' ')}
              fill="rgba(255,92,168,0.07)"
              stroke="rgba(255,92,168,0.5)"
              strokeWidth={1.2}
            />
            {chakras
              .slice()
              .reverse()
              .map((c, i) => {
                const [x, y] = POLY_POINTS[i];
                return <Circle key={c.key} cx={x} cy={y} r={3.5} fill={c.color} />;
              })}
          </Svg>
        </View>

        <View style={styles.statRow}>
          <GlassPanel style={styles.statCard}>
            <MonoLabel size={9}>XP total</MonoLabel>
            <Text style={styles.statValue}>3,140</Text>
            <MonoLabel tint={colors.coPink} size={9}>
              +79 ↑7D
            </MonoLabel>
          </GlassPanel>
          <GlassPanel style={styles.statCard}>
            <MonoLabel size={9}>Streak</MonoLabel>
            <Text style={styles.statValue}>16</Text>
            <MonoLabel tint={colors.coLeaf} size={9}>
              days
            </MonoLabel>
          </GlassPanel>
        </View>

        <View style={styles.legend}>
          {chakras.map((c) => (
            <View key={c.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c.color }]} />
              <MonoLabel size={8.5}>
                {c.label} · {c.mantra}
              </MonoLabel>
            </View>
          ))}
        </View>

        <View style={styles.settingsList}>
          {['Memory & export', 'Reduce motion', 'Notifications', 'Sign out'].map((label) => (
            <View key={label} style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>{label}</Text>
              <MonoLabel size={12}>›</MonoLabel>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 64,
    paddingHorizontal: spacing.sp6,
    paddingBottom: spacing.sp16,
    gap: spacing.sp6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 28,
    color: colors.fg1,
    marginTop: 10,
  },
  settingsButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  polygonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
  },
  statValue: {
    fontFamily: fontFamilies.displaySemibold,
    fontSize: 21,
    color: colors.fg1,
    marginTop: 7,
    marginBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '31%',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  settingsList: {
    borderTopWidth: 1,
    borderTopColor: colors.border1,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border1,
  },
  settingsLabel: {
    fontFamily: fontFamilies.ui,
    fontSize: 14.5,
    color: colors.fg1,
  },
});
