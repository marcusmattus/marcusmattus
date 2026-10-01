import { useMemo } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { VoiceText } from '@/components/ds/VoiceText';
import { NodeBar } from '@/components/ds/NodeBar';
import { ScreenBackground } from '@/components/ds/ScreenBackground';
import { colors, chakras, fontFamilies, spacing, radii } from '@/theme/tokens';
import { nodeColor, useJournalStore } from '@/lib/journalStore';

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEntry, deleteEntry } = useJournalStore();
  const entry = getEntry(id);

  const timeLabel = useMemo(() => {
    if (!entry) return '';
    return new Date(entry.createdAt).toLocaleString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [entry]);

  if (!entry) {
    return (
      <ScreenBackground>
        <View style={styles.missing}>
          <Text style={styles.missingText}>This entry is gone.</Text>
        </View>
      </ScreenBackground>
    );
  }

  function openActions() {
    const options = ['Edit text', 'Delete', 'Copy', 'Cancel'];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 3;
    const handle = (index: number) => {
      if (index === 0) router.push(`/journal/compose?editId=${entry!.id}`);
      if (index === 1) confirmDelete();
      if (index === 2) copyText();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex, cancelButtonIndex }, handle);
    } else {
      Alert.alert('Entry', undefined, [
        { text: 'Edit text', onPress: () => handle(0) },
        { text: 'Delete', style: 'destructive', onPress: () => handle(1) },
        { text: 'Copy', onPress: () => handle(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete entry?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEntry(entry!.id);
          router.back();
        },
      },
    ]);
  }

  async function copyText() {
    await Clipboard.setStringAsync(entry!.text);
  }

  const fieldSnapshot = chakras.map((c) => ({
    ...c,
    value: entry.signals.find((s) => s.node === c.key) ? 55 + Math.round(entry.signals.find((s) => s.node === c.key)!.weight * 30) : 50,
  }));

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <MonoLabel>{timeLabel}</MonoLabel>
          <Pressable onPress={openActions} hitSlop={12}>
            <MonoLabel size={16}>⋯</MonoLabel>
          </Pressable>
        </View>

        <VoiceText style={styles.quote}>&ldquo;{entry.text}&rdquo;</VoiceText>

        <View style={styles.section}>
          <MonoLabel>Signals</MonoLabel>
          {entry.signals.map((s) => {
            const chakra = chakras.find((c) => c.key === s.node);
            return (
              <View key={s.node} style={styles.signalBlock}>
                <View style={styles.signalHeader}>
                  <Text style={[styles.signalName, { color: nodeColor(s.node) }]}>{chakra?.name ?? s.node}</Text>
                  <MonoLabel size={10}>Weight {s.weight.toFixed(1)}</MonoLabel>
                </View>
                <NodeBar weight={s.weight} color={nodeColor(s.node)} />
                <VoiceText style={styles.signalPhrase}>&ldquo;{s.phrase}&rdquo;</VoiceText>
              </View>
            );
          })}
        </View>

        {entry.themes.length > 0 && (
          <View style={styles.section}>
            <MonoLabel>Themes</MonoLabel>
            <View style={styles.themeRow}>
              {entry.themes.map((t) => (
                <View key={t} style={styles.themeChip}>
                  <Text style={styles.themeChipText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {entry.reflectionPrompt ? (
          <View style={styles.section}>
            <MonoLabel>Reflection</MonoLabel>
            <Text style={styles.reflectionText}>{entry.reflectionPrompt}</Text>
            <Pressable style={styles.primaryAction} onPress={() => router.push('/coach')}>
              <Text style={styles.primaryActionText}>Sit with this in Coach</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <MonoLabel>Field at this moment</MonoLabel>
          <View style={styles.fieldRow}>
            {fieldSnapshot.map((c) => (
              <View key={c.key} style={styles.fieldDotCol}>
                <View style={[styles.fieldDot, { backgroundColor: c.color, opacity: 0.35 + (c.value / 100) * 0.65 }]} />
                <MonoLabel size={8}>{c.value}</MonoLabel>
              </View>
            ))}
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quote: {
    fontSize: 22,
    lineHeight: 30,
  },
  section: {
    gap: 12,
  },
  signalBlock: {
    gap: 7,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signalName: {
    fontFamily: fontFamilies.uiMedium,
    fontSize: 14,
  },
  signalPhrase: {
    fontSize: 14,
    color: colors.fg2,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  themeChip: {
    borderWidth: 1,
    borderColor: colors.border1,
    borderRadius: radii.r1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  themeChipText: {
    fontFamily: fontFamilies.ui,
    fontSize: 12,
    color: colors.fg2,
  },
  reflectionText: {
    fontFamily: fontFamilies.ui,
    fontSize: 16,
    lineHeight: 22,
    color: colors.fg1,
  },
  primaryAction: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.coAccent,
    borderRadius: radii.r2,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    fontFamily: fontFamilies.uiMedium,
    fontSize: 13,
    color: colors.coAccent,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldDotCol: {
    alignItems: 'center',
    gap: 6,
  },
  fieldDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    fontFamily: fontFamilies.ui,
    color: colors.fg2,
  },
});
