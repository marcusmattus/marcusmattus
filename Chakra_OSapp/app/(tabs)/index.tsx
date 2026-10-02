import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GlassPanel } from '@/components/ds/GlassPanel';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { Chip } from '@/components/ds/Chip';
import { ScreenBackground } from '@/components/ds/ScreenBackground';
import { colors, chakras, fontFamilies, spacing, radii } from '@/theme/tokens';

// Field index is the mean of all nine chakra readings — placeholder data,
// to be replaced by real field-state once the backend lands.
const READINGS: Record<string, { value: number; delta: number }> = {
  soul: { value: 79, delta: 4 },
  crown: { value: 63, delta: -2 },
  third: { value: 38, delta: -19 },
  throat: { value: 51, delta: 9 },
  heart: { value: 74, delta: 12 },
  solar: { value: 57, delta: 1 },
  sacral: { value: 62, delta: 6 },
  root: { value: 45, delta: -7 },
  earth: { value: 49, delta: -3 },
};

const fieldIndex = Math.round(
  Object.values(READINGS).reduce((sum, r) => sum + r.value, 0) / Object.keys(READINGS).length
);

export default function BodyScreen() {
  const ordered = [...chakras].reverse(); // Soul at top, Earth at bottom, matching the body

  return (
    <ScreenBackground>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <MonoLabel>Today · Wed</MonoLabel>
          <MonoLabel tint={colors.coAccent}>Field Index {fieldIndex}/100</MonoLabel>
        </View>

        <View style={styles.list}>
          {ordered.map((c) => {
            const r = READINGS[c.key];
            const up = r.delta >= 0;
            return (
              <View key={c.key} style={styles.row}>
                <View style={styles.rowLabel}>
                  <Text style={styles.chakraName}>{c.name}</Text>
                  <MonoLabel size={8}>
                    {c.mantra} · {c.hz}
                  </MonoLabel>
                </View>
                <View style={styles.dotCol}>
                  <View style={[styles.glow, { backgroundColor: c.color, opacity: 0.16 }]} />
                  <View style={[styles.dot, { backgroundColor: c.color, shadowColor: c.color }]} />
                </View>
                <View style={styles.valueRow}>
                  <Text style={[styles.value, { color: c.color }]}>{r.value}</Text>
                  <Text style={[styles.delta, { color: up ? colors.coLeaf : colors.coBlood }]}>
                    {up ? '↑' : '↓'}
                    {Math.abs(r.delta)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <GlassPanel style={styles.observation}>
          <MonoLabel>Today&apos;s observation</MonoLabel>
          <Text style={styles.observationBody}>
            Heart and Throat are climbing together for the third day. Third Eye keeps falling on nights you
            write after 11.
          </Text>
          <View style={styles.chipRow}>
            <Chip color={colors.coAccent} active dot>
              5 min breath
            </Chip>
            <Chip color={colors.ckThird} active dot>
              852 Hz pack
            </Chip>
          </View>
        </GlassPanel>

        <View style={styles.toggleRow}>
          <View style={[styles.toggle, styles.toggleActive]}>
            <MonoLabel tint={colors.fg1}>Mudra</MonoLabel>
          </View>
          <View style={styles.toggle}>
            <MonoLabel>Body palm</MonoLabel>
          </View>
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
    alignItems: 'flex-end',
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 47,
  },
  rowLabel: {
    width: 110,
    alignItems: 'flex-end',
    gap: 2,
  },
  chakraName: {
    fontFamily: fontFamilies.uiMedium,
    fontSize: 13,
    color: colors.fg1,
  },
  dotCol: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  valueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontFamily: fontFamilies.displaySemibold,
    fontSize: 17,
  },
  delta: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
  },
  observation: {
    gap: 8,
  },
  observationBody: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.fg1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggle: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radii.r3,
    backgroundColor: 'rgba(14,20,32,0.6)',
    borderWidth: 1,
    borderColor: colors.border1,
  },
  toggleActive: {
    borderColor: colors.border2,
  },
});
