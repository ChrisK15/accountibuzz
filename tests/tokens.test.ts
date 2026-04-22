import { colors, spacing, radii, fonts } from '../src/theme/tokens';

describe('theme tokens', () => {
  it('exposes 60/30/10 color split tokens for both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(colors[theme].primary).toBe('#FFDE42');
      expect(colors[theme].accent).toBe('#53CBF3');
      expect(typeof colors[theme].background).toBe('string');
      expect(typeof colors[theme].surface).toBe('string');
      expect(typeof colors[theme].text).toBe('string');
    }
    expect(colors.light.background).not.toBe(colors.dark.background);
  });
  it('spacing scale matches UI-SPEC', () => {
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 });
  });
  it('radii scale matches UI-SPEC', () => {
    expect(radii).toEqual({ sm: 6, md: 12, lg: 20, pill: 9999 });
  });
  it('fonts declare Manrope family roles', () => {
    expect(fonts.display.fontFamily).toBe('Manrope_800ExtraBold');
    expect(fonts.body.fontFamily).toBe('Manrope_500Medium');
    expect(fonts.display.fontSize).toBe(32);
    expect(fonts.body.fontSize).toBe(16);
  });
});
