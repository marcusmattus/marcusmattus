import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { colors } from '@/theme/tokens';

export type JournalSignal = {
  node: string; // chakra key, e.g. 'heart'
  weight: number; // 0..1
  phrase: string; // the exact quoted phrase that drove this signal
};

export type JournalEntry = {
  id: string;
  text: string;
  createdAt: string; // ISO
  modality: 'text' | 'voice';
  voiceDuration?: number; // seconds, if modality === 'voice'
  signals: JournalSignal[];
  themes: string[];
  source: 'rules' | 'model';
  pending?: boolean; // true while "waiting on" signals, UI-only simulation
  reflectionPrompt?: string;
  prefillNode?: string;
};

const now = new Date();
function daysAgo(n: number, hour: number, minute: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const SEED_ENTRIES: JournalEntry[] = [
  {
    id: 'e1',
    text: 'I felt the tension move out of my chest tonight. The drums under the breath did something I can’t explain.',
    createdAt: daysAgo(0, 23, 42),
    modality: 'text',
    signals: [
      { node: 'heart', weight: 0.8, phrase: 'tension move out of my chest' },
      { node: 'throat', weight: 0.3, phrase: 'something I can’t explain' },
    ],
    themes: ['Release', 'Breathwork'],
    source: 'model',
    reflectionPrompt: 'What else moved tonight, besides the tension?',
  },
  {
    id: 'e2',
    text: 'Woke up tired again. Read the same paragraph of the deck four times.',
    createdAt: daysAgo(1, 8, 12),
    modality: 'text',
    signals: [{ node: 'third', weight: 0.7, phrase: 'read the same paragraph four times' }],
    themes: ['Exhaustion', 'Focus'],
    source: 'rules',
    reflectionPrompt: 'What time did the tiredness start today?',
  },
  {
    id: 'e3',
    text: 'I said the thing I’d been holding for three weeks and nobody left the room.',
    createdAt: daysAgo(1, 21, 58),
    modality: 'voice',
    voiceDuration: 14,
    signals: [{ node: 'throat', weight: 0.85, phrase: 'said the thing I’d been holding' }],
    themes: ['Truth'],
    source: 'model',
    reflectionPrompt: 'What made it safe to say this time?',
  },
  {
    id: 'e4',
    text: 'Quiet morning. Coffee on the step, no rush anywhere.',
    createdAt: daysAgo(2, 7, 30),
    modality: 'text',
    signals: [{ node: 'root', weight: 0.5, phrase: 'no rush anywhere' }],
    themes: ['Grounding'],
    source: 'rules',
  },
];

type JournalStore = {
  entries: JournalEntry[];
  getEntry: (id: string) => JournalEntry | undefined;
  addEntry: (text: string, opts?: { modality?: 'text' | 'voice'; prefillNode?: string }) => string;
  deleteEntry: (id: string) => void;
  updateEntryText: (id: string, text: string) => void;
};

const JournalContext = createContext<JournalStore | null>(null);

// UI-only simulation of the real pipeline's async signal classification
// (spec: "pending entry shows a breathing hairline... chips animate in
// ≤6s"). No backend call here — just a local timer standing in for it.
function simulateSignals(text: string): { signals: JournalSignal[]; themes: string[] } {
  const lower = text.toLowerCase();
  const signals: JournalSignal[] = [];
  if (/tired|drained|heavy|slow/.test(lower)) signals.push({ node: 'third', weight: 0.6, phrase: text.slice(0, 40) });
  if (/heart|love|open|chest/.test(lower)) signals.push({ node: 'heart', weight: 0.65, phrase: text.slice(0, 40) });
  if (/said|spoke|truth|voice/.test(lower)) signals.push({ node: 'throat', weight: 0.6, phrase: text.slice(0, 40) });
  if (signals.length === 0) signals.push({ node: 'root', weight: 0.4, phrase: text.slice(0, 40) });
  return { signals, themes: ['Reflection'] };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<JournalEntry[]>(SEED_ENTRIES);

  const getEntry = useCallback((id: string) => entries.find((e) => e.id === id), [entries]);

  const addEntry = useCallback((text: string, opts?: { modality?: 'text' | 'voice'; prefillNode?: string }) => {
    const id = `e${Date.now()}`;
    const entry: JournalEntry = {
      id,
      text,
      createdAt: new Date().toISOString(),
      modality: opts?.modality ?? 'text',
      signals: [],
      themes: [],
      source: 'rules',
      pending: true,
      prefillNode: opts?.prefillNode,
    };
    setEntries((prev) => [entry, ...prev]);
    setTimeout(() => {
      const { signals, themes } = simulateSignals(text);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, signals, themes, pending: false, source: 'model' } : e)));
    }, 1500);
    return id;
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEntryText = useCallback((id: string, text: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, text } : e)));
  }, []);

  const value = useMemo(
    () => ({ entries, getEntry, addEntry, deleteEntry, updateEntryText }),
    [entries, getEntry, addEntry, deleteEntry, updateEntryText]
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournalStore() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournalStore must be used within JournalProvider');
  return ctx;
}

export function nodeColor(key: string): string {
  const map: Record<string, string> = {
    earth: colors.ckEarth,
    root: colors.ckRoot,
    sacral: colors.ckSacral,
    solar: colors.ckSolar,
    heart: colors.ckHeart,
    throat: colors.ckThroat,
    third: colors.ckThird,
    crown: colors.ckCrown,
    soul: colors.ckSoul,
  };
  return map[key] ?? colors.fg2;
}
