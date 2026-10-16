import { describe, expect, it } from 'vitest';
import { parseJson } from './json';

describe('parseJson', () => {
  it('reads what JSON.parse reads', () => {
    for (const text of ['{"a": [1, 2.5e3, -0, true, false, null], "b": {"c": "d\\n\\u00e9\\"" }}', '[]', '{}', '"x"', '12', ' null ']) {
      expect(parseJson(text)).toEqual({ ok: true, value: JSON.parse(text) });
    }
  });

  it('keeps __proto__ as a key', () => {
    const r = parseJson('{"__proto__": {"x": 1}}');
    expect(r.ok && Object.keys(r.value as object)).toEqual(['__proto__']);
    expect(({} as { x?: number }).x).toBeUndefined();
  });

  it('says the line of the token where reading stops', () => {
    expect(parseJson('{\n  "a": 1,\n  "b": ,\n  "c": 3\n}')).toEqual({ ok: false, line: 3 });
    expect(parseJson('{\n  "a": 1\n  "b": 2\n}')).toEqual({ ok: false, line: 3 });
    expect(parseJson('{"a": 1}\n\nx')).toEqual({ ok: false, line: 3 });
    expect(parseJson('')).toEqual({ ok: false, line: 1 });
  });

  it('refuses what JSON refuses', () => {
    for (const text of ['{a: 1}', "{'a': 1}", '[1,]', '01', '1.', '"a\nb"', '"\\x"', '"\\u12"', 'tru', '{"a":1}}', '[1] 2']) {
      expect(parseJson(text).ok, text).toBe(false);
    }
  });

  it('stops at a depth no record has', () => {
    expect(parseJson('['.repeat(300) + ']'.repeat(300)).ok).toBe(false);
    expect(parseJson('['.repeat(100) + ']'.repeat(100)).ok).toBe(true);
  });
});
