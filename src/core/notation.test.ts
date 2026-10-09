import { describe, expect, it } from 'vitest';
import { setLocale } from './i18n';
import { DEFAULT_NOTATION, notationOptions, NOTATIONS, parseNotation } from './notation';

describe('parseNotation', () => {
  it('reads the notations the settings offer', () => {
    expect(NOTATIONS.map((n) => parseNotation(n))).toEqual(['crowsfoot', 'simple']);
    expect(notationOptions()).toEqual([
      { value: 'crowsfoot', label: "Crow's foot" },
      { value: 'simple', label: 'Simple' },
    ]);
  });

  it("is crow's foot for nothing stored and for a value that is none", () => {
    expect(DEFAULT_NOTATION).toBe('crowsfoot');
    for (const value of [null, undefined, '', 'Simple', 'uml']) expect(parseNotation(value)).toBe('crowsfoot');
  });

  it('names the notations in the language of the app', () => {
    setLocale('vi');
    try {
      expect(notationOptions()[1].label).toBe('Đơn giản');
    } finally {
      setLocale('en');
    }
  });
});
