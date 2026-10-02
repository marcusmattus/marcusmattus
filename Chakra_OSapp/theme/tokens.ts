// chakraOS design tokens — "Clinical Mysticism". Dark only; see design system README.

export const colors = {
  bgPage: '#0A0E18',
  bgGlass: 'rgba(17,23,38,0.55)',
  bgGlassStrong: 'rgba(17,23,38,0.78)',
  border1: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.16)',

  fg1: '#E9ECF5',
  fg2: '#8A90A6',
  fg3: '#565C72',
  fgLabel: '#565C72',
  fg5: '#3A3F52',

  // co-* clinical signal accents — UI chrome, buttons, charts, alerts
  coAccent: '#36D6E7',
  coLeaf: '#3DDC97',
  coBlood: '#FF4D5E',
  coAmber: '#E8B23D',
  coPurple: '#A56BFF',
  coPink: '#FF5CA8',

  // ck-* chakra colors — body data only, never UI chrome
  ckEarth: '#C0433A',
  ckRoot: '#FF4D5E',
  ckSacral: '#FF8A3D',
  ckSolar: '#FFD23D',
  ckHeart: '#36F5A6',
  ckThroat: '#3DB6FF',
  ckThird: '#6B6BFF',
  ckCrown: '#B14DFF',
  ckSoul: '#EAF0FF',
} as const;

export const chakras = [
  { key: 'earth', label: 'EARTH', name: 'Earth Star', hz: 68, mantra: 'LAM', color: colors.ckEarth },
  { key: 'root', label: 'ROOT', name: 'Root', hz: 396, mantra: 'LAM', color: colors.ckRoot },
  { key: 'sacral', label: 'SACRAL', name: 'Sacral', hz: 417, mantra: 'VAM', color: colors.ckSacral },
  { key: 'solar', label: 'SOLAR', name: 'Solar Plexus', hz: 528, mantra: 'RAM', color: colors.ckSolar },
  { key: 'heart', label: 'HEART', name: 'Heart', hz: 639, mantra: 'YAM', color: colors.ckHeart },
  { key: 'throat', label: 'THROAT', name: 'Throat', hz: 741, mantra: 'HAM', color: colors.ckThroat },
  { key: 'third', label: 'THIRD', name: 'Third Eye', hz: 852, mantra: 'OM', color: colors.ckThird },
  { key: 'crown', label: 'CROWN', name: 'Crown', hz: 963, mantra: 'AH', color: colors.ckCrown },
  { key: 'soul', label: 'SOUL', name: 'Soul Star', hz: 1074, mantra: 'AUM', color: colors.ckSoul },
] as const;

export const spacing = {
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp6: 24,
  sp8: 32,
  sp12: 48,
  sp16: 64,
  sp24: 96,
} as const;

export const radii = {
  r1: 6,
  r2: 10,
  r3: 13,
  r4: 16,
  r5: 20,
  r6: 24,
  rFull: 999,
} as const;

export const durations = {
  base: 280,
  breath: 6000,
  heartbeat: 1000,
  drift: 10000,
} as const;

export const fontFamilies = {
  display: 'Outfit_300Light',
  displayMedium: 'Outfit_500Medium',
  displaySemibold: 'Outfit_600SemiBold',
  ui: 'Outfit_400Regular',
  uiMedium: 'Outfit_500Medium',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  journal: 'Lora_400Regular_Italic',
  journalMedium: 'Lora_500Medium_Italic',
} as const;
