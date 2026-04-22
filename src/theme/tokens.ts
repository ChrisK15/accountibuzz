// Design tokens — sourced from .planning/phases/01-foundation/01-UI-SPEC.md
// §Color, §Typography, §Spacing, §Radii. Values locked by design_refs PNGs.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 9999,
} as const;

export const fonts = {
  display: { fontFamily: 'Manrope_800ExtraBold', fontSize: 32, lineHeight: 37 },
  heading1: { fontFamily: 'Manrope_700Bold', fontSize: 24, lineHeight: 30 },
  heading2: { fontFamily: 'Manrope_700Bold', fontSize: 20, lineHeight: 26 },
  body: { fontFamily: 'Manrope_500Medium', fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: 'Manrope_500Medium', fontSize: 13, lineHeight: 18 },
} as const;

export const colors = {
  light: {
    primary: '#FFDE42',
    primaryFg: 'hsl(220, 15%, 15%)',
    accent: '#53CBF3',
    success: 'hsl(145, 55%, 42%)',
    warning: 'hsl(35, 95%, 55%)',
    destructive: 'hsl(4, 78%, 56%)',
    background: 'hsl(30, 30%, 97%)',
    surface: '#FFFFFF',
    surfaceMuted: 'hsl(220, 14%, 92%)',
    border: 'hsl(220, 14%, 88%)',
    text: 'hsl(220, 15%, 15%)',
    textMuted: 'hsl(220, 10%, 45%)',
    textStrong: 'hsl(220, 15%, 10%)',
  },
  dark: {
    primary: '#FFDE42',
    primaryFg: 'hsl(220, 15%, 15%)',
    accent: '#53CBF3',
    success: 'hsl(145, 55%, 42%)',
    warning: 'hsl(35, 95%, 55%)',
    destructive: 'hsl(4, 78%, 56%)',
    background: 'hsl(220, 20%, 6%)',
    surface: 'hsl(220, 18%, 10%)',
    surfaceMuted: 'hsl(220, 15%, 14%)',
    border: 'hsl(220, 12%, 20%)',
    text: 'hsl(30, 20%, 95%)',
    textMuted: 'hsl(220, 10%, 65%)',
    textStrong: 'hsl(0, 0%, 100%)',
  },
} as const;

export type ColorTokens = { readonly [K in keyof typeof colors.light]: string };
export type ThemeName = keyof typeof colors; // 'light' | 'dark'
