// src/theme/applyAlpha.ts
//
// HIGH #5 from REVIEWS replan 2026-05-08:
// Theme tokens in tokens.ts are `hsl(H, S%, L%)` strings (NOT hex). The naive
// idiom `t.colors.surfaceMuted + '66'` produces `hsl(220, 14%, 92%)66` —
// invalid CSS. This helper converts an hsl(...) token + 0..1 alpha into a
// valid `hsla(...)` string.
//
// If the input is not in `hsl(...)` form, the helper logs a one-time warning
// (in __DEV__ only) and returns the input unchanged — defensive fallback so a
// malformed token never crashes the app.

declare const __DEV__: boolean;

export function applyAlpha(hslToken: string, alpha: number): string {
  // Clamp alpha to [0, 1]
  const a = Math.min(1, Math.max(0, alpha));
  // Match `hsl(...)` — comma-separated OR space-separated (CSS Color 4).
  const match = hslToken.trim().match(/^hsl\(\s*([^)]+)\s*\)$/i);
  if (!match) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        `[applyAlpha] expected hsl(...) input, got: ${hslToken}`,
      );
    }
    return hslToken;
  }
  const inner = match[1].trim();
  return `hsla(${inner}, ${a})`;
}
