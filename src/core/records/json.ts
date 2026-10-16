// JSON read by hand, so that where reading stops is the same in every browser: `line` is the line
// of the token it stops at. `JSON.parse` gives a message that differs by engine, and the editor
// marks a line.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonResult = { ok: true; value: JsonValue } | { ok: false; line: number };

const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const MAX_DEPTH = 200;

class Stop {
  readonly at: number;
  constructor(at: number) {
    this.at = at;
  }
}

/** Reads `text` as JSON. A text that is not JSON is `{ ok: false, line }`, the line counting from 1. */
export function parseJson(text: string): JsonResult {
  let i = 0;
  const len = text.length;
  const bad = (): never => {
    throw new Stop(i);
  };
  const ws = () => {
    while (i < len && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  };
  const word = <T extends boolean | null>(w: string, v: T): T => {
    if (text.slice(i, i + w.length) !== w) bad();
    i += w.length;
    return v;
  };
  // `__proto__` is a key like any other: it is defined on the object, never assigned.
  const put = (o: { [key: string]: JsonValue }, k: string, v: JsonValue) => {
    Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
  };
  const str = (): string => {
    let out = '';
    i++;
    for (;;) {
      if (i >= len) bad();
      const c = text[i];
      if (c === '"') {
        i++;
        return out;
      }
      if (c < ' ') bad();
      if (c !== '\\') {
        out += c;
        i++;
        continue;
      }
      const e = text[i + 1];
      if (e === 'u') {
        const hex = text.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          i += 2;
          bad();
        }
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
      } else {
        if (ESCAPES[e] === undefined) {
          i++;
          bad();
        }
        out += ESCAPES[e];
        i += 2;
      }
    }
  };
  const value = (depth: number): JsonValue => {
    if (depth > MAX_DEPTH) bad();
    ws();
    const c = text[i];
    if (c === '{') {
      const o: { [key: string]: JsonValue } = {};
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return o;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') bad();
        const k = str();
        ws();
        if (text[i] !== ':') bad();
        i++;
        put(o, k, value(depth + 1));
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return o;
        }
        bad();
      }
    }
    if (c === '[') {
      const a: JsonValue[] = [];
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return a;
      }
      for (;;) {
        a.push(value(depth + 1));
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return a;
        }
        bad();
      }
    }
    if (c === '"') return str();
    if (c === 't') return word('true', true);
    if (c === 'f') return word('false', false);
    if (c === 'n') return word('null', null);
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(text);
    if (!m) return bad();
    i += m[0].length;
    return Number(m[0]);
  };
  try {
    const v = value(0);
    ws();
    if (i < len) bad();
    return { ok: true, value: v };
  } catch (e) {
    const at = e instanceof Stop ? e.at : i;
    return { ok: false, line: text.slice(0, Math.min(at, len)).split('\n').length };
  }
}

export function isJsonObject(v: unknown): v is { [key: string]: JsonValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
