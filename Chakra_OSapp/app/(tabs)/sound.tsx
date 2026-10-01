import { StyleSheet, Text, View } from 'react-native';
import { Pause, SkipBack, SkipForward } from 'lucide-react-native';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { Chip } from '@/components/ds/Chip';
import { ScreenBackground } from '@/components/ds/ScreenBackground';
import { colors, fontFamilies, spacing } from '@/theme/tokens';

const RINGS = [220, 212, 172, 132, 92, 52];

export default function SoundScreen() {
  return (
    <ScreenBackground>
      <View style={styles.content}>
        <View style={styles.header}>
          <MonoLabel tint={colors.coPurple}>Now playing · Session 03</MonoLabel>
          <Text style={styles.title}>Third Eye Restoration</Text>
        </View>

        <View style={styles.orb}>
          {RINGS.map((size, i) => (
            <View
              key={size}
              style={[
                styles.ring,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderColor: `rgba(107,107,255,${0.14 + i * 0.09})`,
                },
              ]}
            />
          ))}
          <View style={styles.core} />
        </View>

        <View style={styles.meta}>
          <MonoLabel tint={colors.fg1} size={11}>
            852 Hz · Low drone
          </MonoLabel>
          <MonoLabel size={10} style={{ marginTop: 4 }}>
            Binaural beat 8 Hz · Alpha · 12 min
          </MonoLabel>
          <View style={styles.tagRow}>
            <Chip color={colors.ckThird} active dot>
              Third Eye
            </Chip>
            <Chip color={colors.fg2}>Restorative</Chip>
            <Chip color={colors.fg2}>Solfeggio</Chip>
          </View>
        </View>

        <View style={styles.scrubRow}>
          <MonoLabel size={10}>3:12</MonoLabel>
          <View style={styles.track}>
            <View style={styles.trackFill} />
            <View style={styles.trackKnob} />
          </View>
          <MonoLabel size={10}>12:00</MonoLabel>
        </View>

        <View style={styles.transport}>
          <SkipBack size={16} color={colors.fg2} strokeWidth={1.5} />
          <View style={styles.playButton}>
            <Pause size={18} color={colors.coPurple} strokeWidth={2} />
          </View>
          <SkipForward size={16} color={colors.fg2} strokeWidth={1.5} />
        </View>

        <View style={styles.upNext}>
          <MonoLabel>Up next</MonoLabel>
          <View style={styles.upNextRow}>
            <Text style={styles.upNextTitle}>Heart Coherence</Text>
            <MonoLabel size={9.5}>639 Hz · 9 min</MonoLabel>
          </View>
          <View style={styles.upNextRow}>
            <Text style={styles.upNextTitle}>Ground · Earth Drone</Text>
            <MonoLabel size={9.5}>174 Hz · 18 min</MonoLabel>
          </View>
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: spacing.sp6,
    gap: spacing.sp4,
  },
  header: {
    gap: 10,
  },
  title: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 22,
    color: colors.fg1,
  },
  orb: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  core: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ckThird,
    shadowColor: colors.ckThird,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  meta: {
    alignItems: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 8,
  },
  track: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border2,
    borderRadius: 2,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '27%',
    backgroundColor: colors.coPurple,
    borderRadius: 2,
  },
  trackKnob: {
    position: 'absolute',
    left: '27%',
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coPurple,
    marginLeft: -4,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,107,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(165,107,255,0.55)',
  },
  upNext: {
    marginTop: spacing.sp6,
    paddingTop: spacing.sp4,
    borderTopWidth: 1,
    borderTopColor: colors.border1,
    gap: 11,
  },
  upNextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  upNextTitle: {
    fontFamily: fontFamilies.ui,
    fontSize: 13.5,
    color: colors.fg1,
  },
});
