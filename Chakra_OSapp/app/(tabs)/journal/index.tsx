import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { GlassPanel } from '@/components/ds/GlassPanel';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { VoiceText } from '@/components/ds/VoiceText';
import { ScreenBackground } from '@/components/ds/ScreenBackground';
import { MicGlyph } from '@/components/ds/MicGlyph';
import { colors, chakras, fontFamilies, spacing, radii } from '@/theme/tokens';
import { JournalEntry, nodeColor, useJournalStore } from '@/lib/journalStore';

const FILTERS = [{ key: 'all', label: 'All' }, ...chakras.map((c) => ({ key: c.key, label: c.name })), { key: 'voice', label: 'Voice' }];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'TODAY';
  if (sameDay(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function computeStreak(entries: JournalEntry[]) {
  const days = new Set(entries.map((e) => new Date(e.createdAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function PendingHairline() {
  const [pulse] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.pendingLine, { opacity: pulse }]} />;
}

function EntryRow({ entry }: { entry: JournalEntry }) {
  return (
    <Pressable style={styles.entryRow} onPress={() => router.push(`/journal/${entry.id}`)}>
      <VoiceText numberOfLines={3} style={styles.entryQuote}>
        &ldquo;{entry.text}&rdquo;
      </VoiceText>
      <View style={styles.entryMeta}>
        <MonoLabel size={10.5}>
          {timeLabel(entry.createdAt)} · {entry.modality === 'voice' ? `VOICE ${formatDuration(entry.voiceDuration)}` : 'TEXT'}
        </MonoLabel>
        {entry.source === 'rules' && !entry.pending ? <MonoLabel size={9} tint={colors.fg5}>Rules</MonoLabel> : null}
      </View>
      {entry.pending ? (
        <PendingHairline />
      ) : (
        <View style={styles.chipRow}>
          {entry.signals.slice(0, 3).map((s) => (
            <View key={s.node} style={[styles.signalChip, { borderColor: withAlpha(nodeColor(s.node), 0.4) }]}>
              <View style={[styles.signalDot, { backgroundColor: nodeColor(s.node) }]} />
              <Text style={[styles.signalText, { color: nodeColor(s.node) }]}>
                {s.node.toUpperCase()} {s.weight.toFixed(1)}
              </Text>
            </View>
          ))}
          {entry.themes.slice(0, 2).map((t) => (
            <Text key={t} style={styles.themeChip}>
              {t}
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function formatDuration(sec?: number) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function JournalTimeline() {
  const { entries, addEntry } = useJournalStore();
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState('');

  const streak = useMemo(() => computeStreak(entries), [entries]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'voice') return entries.filter((e) => e.modality === 'voice');
    return entries.filter((e) => e.signals.some((s) => s.node === filter));
  }, [entries, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of filtered) {
      const label = dayLabel(e.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    addEntry(text);
    setDraft('');
  }

  return (
    <ScreenBackground>
      <View style={styles.header}>
        <MonoLabel>
          Journal · {entries.length} entries · {streak} day streak
        </MonoLabel>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const tint = f.key === 'all' || f.key === 'voice' ? colors.coAccent : nodeColor(f.key);
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && { borderColor: withAlpha(tint, 0.5), backgroundColor: withAlpha(tint, 0.12) }]}>
              <MonoLabel size={9.5} tint={active ? tint : colors.fg3}>
                {f.label}
              </MonoLabel>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyDots}>
              {chakras.map((c) => (
                <View key={c.key} style={[styles.emptyDot, { backgroundColor: c.color, opacity: 0.35 }]} />
              ))}
            </View>
            <Text style={styles.emptyText}>Write your first sentence.</Text>
          </View>
        ) : (
          groups.map(([label, dayEntries]) => (
            <View key={label} style={styles.dayGroup}>
              <MonoLabel size={10} style={styles.dayHeader}>
                {label}
              </MonoLabel>
              {dayEntries.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <GlassPanel radius={radii.r5} style={styles.dockWrap} contentStyle={styles.dock}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="One sentence about now"
          placeholderTextColor={colors.fg3}
          style={styles.dockInput}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable style={styles.dockMic} onPress={() => router.push('/journal/compose')}>
          <MicGlyph color={colors.fg3} />
        </Pressable>
      </GlassPanel>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.sp6,
    paddingBottom: spacing.sp3,
  },
  filterRow: {
    paddingHorizontal: spacing.sp6,
    gap: 7,
    paddingBottom: spacing.sp3,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border1,
    borderRadius: radii.r1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  list: {
    paddingHorizontal: spacing.sp6,
    paddingBottom: 120,
    gap: spacing.sp4,
  },
  dayGroup: {
    gap: spacing.sp3,
  },
  dayHeader: {
    marginBottom: 2,
  },
  entryRow: {
    paddingBottom: spacing.sp3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border1,
    gap: 8,
  },
  entryQuote: {
    fontSize: 17,
  },
  entryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  signalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radii.r1,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  signalDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  signalText: {
    fontFamily: fontFamilies.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  themeChip: {
    fontFamily: fontFamilies.ui,
    fontSize: 12,
    color: colors.fg2,
    alignSelf: 'center',
  },
  pendingLine: {
    height: 1,
    backgroundColor: colors.coAccent,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.sp24,
    gap: spacing.sp4,
  },
  emptyDots: {
    flexDirection: 'row',
    gap: 6,
  },
  emptyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  emptyText: {
    fontFamily: fontFamilies.ui,
    fontSize: 14,
    color: colors.fg2,
  },
  dockWrap: {
    position: 'absolute',
    left: spacing.sp4,
    right: spacing.sp4,
    bottom: spacing.sp4,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dockInput: {
    flex: 1,
    fontFamily: fontFamilies.journal,
    fontSize: 17,
    color: colors.fg1,
    paddingVertical: 8,
  },
  dockMic: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
