import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MonoLabel } from '@/components/ds/MonoLabel';
import { MicGlyph } from '@/components/ds/MicGlyph';
import { colors, fontFamilies, spacing, radii } from '@/theme/tokens';
import { useJournalStore } from '@/lib/journalStore';

const MAX_LEN = 140;

export default function ComposeModal() {
  const { editId, prefillNode } = useLocalSearchParams<{ editId?: string; prefillNode?: string }>();
  const { getEntry, addEntry, updateEntryText } = useJournalStore();
  const editing = editId ? getEntry(editId) : undefined;
  const [text, setText] = useState(editing?.text ?? '');

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editing) {
      updateEntryText(editing.id, trimmed);
    } else {
      addEntry(trimmed, { prefillNode });
    }
    router.back();
  }

  function onMicPress() {
    Alert.alert('Voice', 'Voice arrives in a later build.');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MonoLabel>Cancel</MonoLabel>
        </Pressable>
        <Pressable onPress={submit} hitSlop={12} disabled={!text.trim()}>
          <MonoLabel tint={text.trim() ? colors.coAccent : colors.fg5}>{editing ? 'Save' : 'Submit'}</MonoLabel>
        </Pressable>
      </View>

      {prefillNode ? (
        <View style={styles.prefillTag}>
          <MonoLabel size={9.5} tint={colors.coAccent}>
            {prefillNode.toUpperCase()}
          </MonoLabel>
        </View>
      ) : null}

      <TextInput
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX_LEN))}
        placeholder="One sentence about now"
        placeholderTextColor={colors.fg3}
        style={styles.input}
        multiline
        autoFocus
        maxLength={MAX_LEN}
      />

      <View style={styles.bottomRow}>
        <MonoLabel size={10}>
          {String(text.length).padStart(3, '0')} / {MAX_LEN}
        </MonoLabel>
        <Pressable style={styles.micButton} onPress={onMicPress}>
          <MicGlyph size={18} color={colors.fg2} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bgPage,
    paddingTop: 20,
    paddingHorizontal: spacing.sp6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sp6,
  },
  prefillTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.coAccent,
    borderRadius: radii.r1,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: spacing.sp4,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.journal,
    fontSize: 22,
    lineHeight: 30,
    color: colors.fg1,
    textAlignVertical: 'top',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sp4,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
