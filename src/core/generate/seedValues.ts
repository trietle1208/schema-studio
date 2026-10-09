import { normalizeType } from '../datatypes';

// What a sample value of a column looks like: the kind of data a type holds, and the words and
// numbers a column's name suggests (`email`, `price`, `status`). Everything is drawn from a
// generator the caller seeds, so the same seed always gives the same data.

/** A source of numbers in [0, 1). */
export type Random = () => number;

/** A seeded generator (mulberry32): the same seed gives the same numbers. */
export function randomFrom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32-bit number for a text (FNV-1a), to seed a generator per table. */
export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A whole number from `low` to `high`, both included. */
export const between = (r: Random, low: number, high: number) => low + Math.floor(r() * (high - low + 1));
export const pick = <T>(r: Random, list: readonly T[]): T => list[Math.floor(r() * list.length)];

// ------------------------------------------------------------------------------------- kinds

/** What a column's type holds. */
export type Kind =
  | { type: 'serial' }
  | { type: 'int'; max: number }
  | { type: 'decimal'; precision: number; scale: number }
  | { type: 'float' }
  | { type: 'bool' }
  | { type: 'text'; max: number | null }
  | { type: 'uuid' }
  | { type: 'timestamp' }
  | { type: 'date' }
  | { type: 'time' }
  | { type: 'year' }
  | { type: 'json' }
  | { type: 'binary'; bytes: number | null }
  | { type: 'enum'; options: string[] }
  | { type: 'ip' }
  | { type: 'interval' }
  | { type: 'array' }
  | { type: 'unknown' };

/** Sample integers stay small, whatever the type could hold. */
const INT_CAP = 100_000;
const INT_MAX: Record<string, number> = { SMALLINT: 32767, INT2: 32767, MEDIUMINT: 8388607, INT: INT_CAP, INTEGER: INT_CAP, INT4: INT_CAP, BIGINT: INT_CAP, INT8: INT_CAP };
const SERIAL = new Set(['SERIAL', 'SERIAL2', 'SERIAL4', 'SERIAL8', 'SMALLSERIAL', 'BIGSERIAL']);
const TEXT_MAX: Record<string, number | null> = { TEXT: null, TINYTEXT: 255, MEDIUMTEXT: null, LONGTEXT: null, CITEXT: null, STRING: null, NAME: 63 };
const TEXT = new Set(['VARCHAR', 'VARCHAR2', 'NVARCHAR', 'CHARACTER VARYING', 'CHAR', 'NCHAR', 'CHARACTER', 'BPCHAR', ...Object.keys(TEXT_MAX)]);
const TIMESTAMP = new Set(['TIMESTAMP', 'TIMESTAMPTZ', 'DATETIME', 'DATETIME2', 'SMALLDATETIME', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITHOUT TIME ZONE']);
const TIME = new Set(['TIME', 'TIMETZ', 'TIME WITH TIME ZONE', 'TIME WITHOUT TIME ZONE']);
const BINARY = new Set(['BYTEA', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BINARY', 'VARBINARY']);

/** The values of an `ENUM('a','b')` or `SET('a','b')`. */
function listedValues(args: string): string[] {
  return [...args.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

/** What a type holds. A type this does not know is `unknown`. */
export function columnKind(type: string): Kind {
  const upper = normalizeType(type);
  if (/\[\d*\]$/.test(upper) || /\bARRAY$/.test(upper)) return { type: 'array' };
  const args = /\(([^)]*)\)/.exec(upper)?.[1] ?? '';
  const numbers = args.split(',').flatMap((n) => (/^\s*\d+\s*$/.test(n) ? [Number(n)] : []));
  const counting = /\bAUTO_INCREMENT\b/.test(upper);
  const name = upper.replace(/\([^)]*\)/g, '').replace(/\b(UNSIGNED|SIGNED|ZEROFILL|AUTO_INCREMENT)\b/g, '').replace(/\s+/g, ' ').trim();

  if (SERIAL.has(name)) return { type: 'serial' };
  if (name === 'TINYINT') return numbers[0] === 1 ? { type: 'bool' } : counting ? { type: 'serial' } : { type: 'int', max: /UNSIGNED/.test(upper) ? 255 : 127 };
  if (name in INT_MAX) return counting ? { type: 'serial' } : { type: 'int', max: INT_MAX[name] };
  if (['DECIMAL', 'NUMERIC', 'DEC', 'FIXED', 'MONEY'].includes(name)) {
    const [precision = 12, scale = numbers.length ? 0 : 2] = numbers;
    return { type: 'decimal', precision: Math.max(1, precision), scale: Math.min(scale, precision) };
  }
  if (['FLOAT', 'FLOAT4', 'FLOAT8', 'REAL', 'DOUBLE', 'DOUBLE PRECISION'].includes(name)) return { type: 'float' };
  if (['BOOLEAN', 'BOOL', 'BIT'].includes(name)) return { type: 'bool' };
  if (name === 'UUID') return { type: 'uuid' };
  if (TEXT.has(name)) {
    // A CHAR(36) is a UUID kept as text.
    if ((name === 'CHAR' || name === 'CHARACTER') && numbers[0] === 36) return { type: 'uuid' };
    return { type: 'text', max: name in TEXT_MAX ? TEXT_MAX[name] : (numbers[0] ?? (name === 'CHAR' || name === 'CHARACTER' || name === 'NCHAR' ? 1 : null)) };
  }
  if (TIMESTAMP.has(name)) return { type: 'timestamp' };
  if (name === 'DATE') return { type: 'date' };
  if (TIME.has(name)) return { type: 'time' };
  if (name === 'YEAR') return { type: 'year' };
  if (name === 'JSON' || name === 'JSONB') return { type: 'json' };
  if (BINARY.has(name)) return { type: 'binary', bytes: numbers[0] ?? null };
  if (name === 'ENUM' || name === 'SET') {
    // The values keep their case, which the upper-cased type has lost.
    const options = listedValues(/\(([\s\S]*)\)/.exec(type)?.[1] ?? '');
    return options.length ? { type: 'enum', options } : { type: 'unknown' };
  }
  if (name === 'INET' || name === 'CIDR') return { type: 'ip' };
  if (name === 'INTERVAL') return { type: 'interval' };
  return { type: 'unknown' };
}

// ----------------------------------------------------------------------------------- words

const FIRST_NAMES = ['Alice', 'Bao', 'Carlos', 'Dung', 'Emma', 'Farah', 'Giang', 'Hiro', 'Ivy', 'Jonas', 'Khanh', 'Linh', 'Mateo', 'Nam', 'Olivia', 'Phuong', 'Quinn', 'Rosa', 'Son', 'Tuan'];
const LAST_NAMES = ['Nguyen', 'Tran', 'Le', 'Pham', 'Smith', 'Garcia', 'Kim', 'Tanaka', 'Singh', 'Muller', 'Silva', 'Brown'];
const STREETS = ['Main St', 'Oak Ave', 'Maple Rd', 'Lake View', 'Hillcrest Dr', 'Nguyen Hue', 'Park Lane', 'Station Rd'];
const CITIES = ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Singapore', 'Berlin', 'Lisbon', 'Austin', 'Osaka', 'Toronto', 'Lyon'];
const COUNTRIES = ['Vietnam', 'Singapore', 'Germany', 'Portugal', 'United States', 'Japan', 'Canada', 'France'];
const LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat').split(' ');

/** Words that a column named for a kind of thing takes its value from. */
const VOCABULARY: [RegExp, readonly string[]][] = [
  [/currency/, ['USD', 'EUR', 'VND', 'GBP']],
  [/gender|sex/, ['female', 'male', 'other']],
  [/(^|_)(lang|language|locale)$/, ['en', 'vi', 'fr', 'de']],
  [/priority|severity/, ['low', 'medium', 'high']],
  [/(^|_)(plan|tier)$/, ['free', 'pro', 'team']],
  [/role$/, ['admin', 'editor', 'viewer']],
  [/provider|gateway/, ['stripe', 'paypal', 'vnpay', 'momo']],
  [/method/, ['card', 'bank_transfer', 'cash', 'wallet']],
  [/status|(^|_)state$|stage/, ['active', 'pending', 'completed', 'cancelled']],
  [/(^|_)(type|kind|category|channel|source|level|mode)$/, ['standard', 'premium', 'basic']],
];

const HEX = '0123456789abcdef';
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./';
const randomChars = (r: Random, alphabet: string, length: number) => Array.from({ length }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
const pad = (n: number, width: number) => String(n).padStart(width, '0');
const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** A sentence of `words` words from the placeholder text, starting with a capital and ending in a full stop. */
function sentence(r: Random, words: number): string {
  return `${capitalize(Array.from({ length: words }, () => pick(r, LOREM)).join(' '))}.`;
}

/** The first and last name of a person, drawn so that they are the same for the same row of a table. */
export function personOf(r: Random): { first: string; last: string } {
  return { first: pick(r, FIRST_NAMES), last: pick(r, LAST_NAMES) };
}

export interface TextContext {
  r: Random;
  /** The number of the row, from 0. */
  row: number;
  /** The name of the column, as it is in the table. */
  column: string;
  /** What one row of the table is called: `users` → `user`. */
  noun: string;
  /** Whether the table is about people, so that a `name` is the name of one. */
  person: boolean;
}

/** A text for a column of that name: an email for `email`, a status for `status`. The caller cuts it to the length of the column. */
export function textFor({ r, row, column, noun, person }: TextContext): string {
  const n = column.toLowerCase();
  const { first, last } = personOf(r);
  const number = row + 1;
  if (/e_?mail/.test(n)) return `${first}.${last}${number}@example.com`.toLowerCase();
  if (/(^|_)(first|given)_?name$|^fname$/.test(n)) return first;
  if (/(^|_)(last|family|sur)_?name$|^lname$/.test(n)) return last;
  if (/(^|_)(full|display)_?name$/.test(n)) return `${first} ${last}`;
  if (/user_?name|^login$|^handle$|^nickname$/.test(n)) return `${first}_${last}${number}`.toLowerCase();
  if (/pass(word)?(_?hash)?$|^pwd|secret/.test(n)) return `$2b$10$${randomChars(r, BASE64, 53)}`;
  if (/phone|mobile|^tel$|fax/.test(n)) return `+1-555-${pad(between(r, 0, 999), 3)}-${pad(between(r, 0, 9999), 4)}`;
  if (/(^|_)ip(_address)?$/.test(n)) return `192.168.${between(r, 0, 255)}.${between(r, 1, 254)}`;
  if (/(^|_)url$|website|link$|^uri$|avatar|image|photo|picture|thumbnail|logo/.test(n)) return `https://example.com/${n.replace(/_?url$/, '') || 'item'}/${number}`;
  if (/street|address/.test(n)) return `${between(r, 1, 999)} ${pick(r, STREETS)}`;
  if (/(^|_)city$/.test(n)) return pick(r, CITIES);
  if (/country_?code/.test(n)) return pick(r, ['VN', 'SG', 'DE', 'PT', 'US', 'JP']);
  if (/country/.test(n)) return pick(r, COUNTRIES);
  if (/zip|postal|post_?code/.test(n)) return pad(between(r, 0, 99999), 5);
  for (const [pattern, words] of VOCABULARY) if (pattern.test(n)) return pick(r, words);
  if (/sku/.test(n)) return `SKU-${pad(number, 4)}`;
  if (/slug/.test(n)) return `${pick(r, LOREM)}-${number}`;
  if (/token|api_?key|hash|checksum|digest/.test(n)) return randomChars(r, HEX, 32);
  if (/code$/.test(n)) return `C${pad(number, 4)}`;
  if (/colou?r/.test(n)) return `#${randomChars(r, HEX, 6)}`;
  if (/title|subject|headline/.test(n)) return sentence(r, between(r, 3, 5)).slice(0, -1);
  if (/desc|summary|bio$|about|content|body|comment|note|message|text|detail|remark|reason/.test(n)) return `${sentence(r, between(r, 5, 9))} ${sentence(r, between(r, 4, 8))}`;
  if (/(^|_)name$|label|caption/.test(n)) {
    const prefix = n.replace(/_?(name|label|caption)$/, '').replace(/_/g, ' ');
    if (prefix) return `${capitalize(prefix)} ${number}`;
    return person ? `${first} ${last}` : `${capitalize(noun)} ${number}`;
  }
  return `${n.replace(/_/g, ' ')} ${number}`;
}

// --------------------------------------------------------------------------------- numbers

export interface NumberRange {
  low: number;
  high: number;
  /** A range for money: with cents. */
  money?: boolean;
}

/** The range of values for a number column of that name. `row` is the number of the row, from 0, for a column that counts. */
export function numberRange(column: string, row: number): NumberRange {
  const n = column.toLowerCase();
  if (/price|amount|total|cost|fee|balance|salary|revenue|subtotal|tax|payment/.test(n)) return { low: 5, high: 500, money: true };
  if (/qty|quantity|count|stock|units|number_of|(^|_)num_/.test(n)) return { low: 1, high: 20 };
  if (/(^|_)age$/.test(n)) return { low: 18, high: 80 };
  if (/rating|score|stars/.test(n)) return { low: 1, high: 5 };
  if (/percent|pct|rate|discount/.test(n)) return { low: 0, high: 50 };
  if (/(^|_)lat(itude)?$/.test(n)) return { low: -90, high: 90 };
  if (/(^|_)(lng|lon|long|longitude)$/.test(n)) return { low: -180, high: 180 };
  if (/weight|height|width|length|size|duration|distance/.test(n)) return { low: 1, high: 200 };
  if (/sort|position|rank|sequence|(^|_)seq$|(^|_)order$/.test(n)) return { low: row + 1, high: row + 1 };
  if (/version/.test(n)) return { low: 1, high: 5 };
  return { low: 1, high: 1000 };
}

/** How likely a column of that name is true. */
export function trueChance(column: string): number {
  const n = column.toLowerCase();
  if (/deleted|archived|banned|blocked|hidden|locked|disabled|cancel|spam/.test(n)) return 0.1;
  if (/active|enabled|verified|visible|published|confirmed|public|approved/.test(n)) return 0.85;
  return 0.5;
}

// ----------------------------------------------------------------------------------- dates

/** Sample dates are drawn from the two years from here (all in the past), so they do not depend on the day the data is made. */
const ANCHOR = Date.UTC(2024, 0, 1);
export const DAY = 86_400_000;
const SPAN = 2 * 365 * DAY;

/** The moment a column of that name is about, in ms since the epoch. */
export function momentFor(r: Random, column: string): number {
  const n = column.toLowerCase();
  if (/birth|dob/.test(n)) return Date.UTC(1960, 0, 1) + Math.floor(r() * 45 * 365 * DAY);
  if (/expire|due|(^|_)end|until|valid_to|deadline/.test(n)) return ANCHOR + SPAN + Math.floor(r() * SPAN);
  return ANCHOR + Math.floor(r() * SPAN);
}

function parts(ms: number) {
  const d = new Date(ms);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`,
    time: `${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)}`,
  };
}

/** A moment as the literal of a column of the kind: `2025-03-04 10:15:00`, `2025-03-04`, `10:15:00`. */
export function formatMoment(ms: number, kind: 'timestamp' | 'date' | 'time'): string {
  const { date, time } = parts(ms);
  return kind === 'date' ? date : kind === 'time' ? time : `${date} ${time}`;
}

export { HEX, randomChars };
