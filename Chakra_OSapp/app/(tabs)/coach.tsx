import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { GlassPanel } from '@/components/ds/GlassPanel';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { VoiceText } from '@/components/ds/VoiceText';
import { ScreenBackground } from '@/components/ds/ScreenBackground';
import { colors, fontFamilies, spacing, radii } from '@/theme/tokens';

const SUGGESTIONS = [
  { tag: 'Breathwork · 5 min', title: 'Box breathing, 4-4-4-4', sub: 'Steady the nervous system', color: colors.coLeaf },
  { tag: 'Sound · 852 Hz · 12 min', title: 'Third Eye restoration', sub: 'Quiet labyrinthine + low drone', color: colors.ckThird },
  { tag: 'Reflect · 2 min', title: 'One sentence on what drained you', sub: 'Loops back into pattern analysis', color: colors.coAmber },
];

export default function CoachScreen() {
  return (
    <ScreenBackground>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <MonoLabel tint={colors.coLeaf}>Awareness · Memory · Frequency</MonoLabel>
          <Text style={styles.title}>Coach</Text>
        </View>

        <GlassPanel style={{ gap: 12 }}>
          <Text style={styles.observation}>
            Over the last 7 days your journal mentions <Text style={{ color: colors.coLeaf }}>tired</Text> or{' '}
            <Text style={{ color: colors.coLeaf }}>drained</Text> six times, five of them written after 11 PM.
          </Text>
          <Text style={styles.observation}>Third Eye is at 38, down 19% this week.</Text>
          <MonoLabel style={{ marginTop: 4 }}>Suggested · tap to begin</MonoLabel>
          <View style={{ gap: 8 }}>
            {SUGGESTIONS.map((s) => (
              <View key={s.title} style={styles.suggestion}>
                <MonoLabel tint={s.color} size={9.5}>
                  {s.tag}
                </MonoLabel>
                <Text style={styles.suggestionTitle}>{s.title}</Text>
                <Text style={styles.suggestionSub}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </GlassPanel>

        <View style={styles.bubbleRow}>
          <View style={styles.bubble}>
            <VoiceText style={styles.bubbleText}>&ldquo;Let&apos;s start with the breath.&rdquo;</VoiceText>
          </View>
        </View>

        <View style={styles.composer}>
          <VoiceText style={styles.composerText}>Ask, or just notice…</VoiceText>
          <View style={styles.composerSend}>
            <ArrowRight size={15} color={colors.coLeaf} strokeWidth={2} />
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
  headerBlock: {
    gap: 10,
  },
  title: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 28,
    color: colors.fg1,
  },
  observation: {
    fontFamily: fontFamilies.ui,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.fg1,
  },
  suggestion: {
    backgroundColor: 'rgba(14,20,32,0.6)',
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radii.r3,
    padding: 13,
    gap: 6,
  },
  suggestionTitle: {
    fontFamily: fontFamilies.uiMedium,
    fontSize: 14,
    color: colors.fg1,
  },
  suggestionSub: {
    fontFamily: fontFamilies.ui,
    fontSize: 12.5,
    color: colors.fg2,
  },
  bubbleRow: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '74%',
    backgroundColor: 'rgba(14,20,32,0.7)',
    borderWidth: 1,
    borderColor: colors.border1,
    borderRadius: radii.r5,
    borderBottomRightRadius: 6,
    padding: 14,
  },
  bubbleText: {
    fontSize: 15.5,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.border1,
    borderRadius: radii.r5,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  composerText: {
    flex: 1,
    color: colors.fg3,
    fontSize: 15,
  },
  composerSend: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.fg3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
