import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, parseTheme, THEMES } from './theme';

describe('parseTheme', () => {
  it('reads the themes the settings offer', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(THEMES.map((t) => parseTheme(t.value))).toEqual(['dark', 'light']);
  });

  it('is dark for nothing stored and for a value that is no theme', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(parseTheme(null)).toBe('dark');
    expect(parseTheme(undefined)).toBe('dark');
    expect(parseTheme('')).toBe('dark');
    expect(parseTheme('Light')).toBe('dark');
    expect(parseTheme('system')).toBe('dark');
  });
});
