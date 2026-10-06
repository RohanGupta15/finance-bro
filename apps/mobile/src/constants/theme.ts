import { Platform } from 'react-native';

/**
 * Design tokens. Provisional palette until the UI design pass; keep every colour
 * in the app flowing from here so that pass is a one-file change.
 */
export const Colors = {
  light: {
    text: '#111214',
    textSecondary: '#5F636B',
    background: '#F6F6F4',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7E8E4',
    border: '#E2E3DF',
    accent: '#1F6F5C',
    onAccent: '#FFFFFF',
    credit: '#1E8A5A',
    debit: '#C2412D',
  },
  dark: {
    text: '#F4F4F2',
    textSecondary: '#A7ABB2',
    background: '#0E0F10',
    backgroundElement: '#1A1B1D',
    backgroundSelected: '#2A2C2F',
    border: '#2E3033',
    accent: '#4FBF9F',
    onAccent: '#0E0F10',
    credit: '#45C88A',
    debit: '#FF6B57',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  card: 16,
  pill: 999,
} as const;
