import { createContext, useContext } from 'react';
import {
  colors,
  spacing,
  radii,
  fonts,
  type ColorTokens,
  type ThemeName,
} from './tokens';

export interface Theme {
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  fonts: typeof fonts;
  name: ThemeName;
}

export const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
