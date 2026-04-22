import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  useFonts,
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { colors, spacing, radii, fonts, type ThemeName } from './tokens';
import { ThemeContext, type Theme } from './useTheme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const rawScheme = useColorScheme();
  const scheme: ThemeName = rawScheme === 'dark' ? 'dark' : 'light';

  if (!fontsLoaded) return null;

  const value: Theme = {
    colors: colors[scheme],
    spacing,
    radii,
    fonts,
    name: scheme,
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
