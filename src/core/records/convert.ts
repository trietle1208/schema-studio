import { t } from '../i18n';
import type { Column } from '../model';
import { cellKind } from './cells';
import { formatMoment, isIntegerType, isTextField, typeLength, typeScale, validMoment, type FieldMeta, type Moment } from './fields';
import { parseJson } from './json';
import type { RecordValue } from '.';

// One cell of a file as the value of a column: what a number, a date or a yes is called in a file,
// and the problem when the cell is none of them. What is checked is what the database would
// refuse, in the words of the record form.

/** What a cell of a file holds: text for CSV, and for JSON also numbers, booleans and NULL. */
export type SourceCell = string | number | boolean | null;

/** What a date written `03/04/2026` means: `dmy` is the 3rd of April, `mdy` the 4th of March. */
export type DateOrder = 'dmy' | 'mdy';

/** What the review groups a problem by. */
export type ConvertProblemKind = 'required' | 'type' | 'date';

export interface ConvertOptions {
  /** An empty cell is NULL; in a text column it is otherwise the empty text. */
  emptyNull: boolean;
  /** How `03/04/2026` is read; day first when left out. */
  dateOrder?: DateOrder;
}

export interface Converted {
  /** What goes into the column; undefined where the default of the column fills in. A cell with a problem keeps what the file had. */
  value: RecordValue | undefined;
  problem?: { kind: ConvertProblemKind; message: string };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

// A time of day: `9:05`, `09:05:30.250`, `9:05 PM`, with a time zone after it (`Z`, `+07:00`).
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(?:([ap])\.?m\.?)?\s*(Z|UTC|GMT|[+-]\d{2}(?::?\d{2})?)?$/i;

interface Clock {
  hour: number;
  minute: number;
  second: number;
  /** Minutes east of UTC; null when the text names no time zone. */
  offset: number | null;
}

function readClock(text: string): Clock | null {
  const m = TIME.exec(text.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  if (m[4]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (m[4].toLowerCase() === 'p' ? 12 : 0);
  }
  let offset: number | null = null;
  const zone = m[5];
  if (zone) {
    const z = /^([+-])(\d{2}):?(\d{2})?$/.exec(zone);
    offset = z ? (z[1] === '-' ? -1 : 1) * (Number(z[2]) * 60 + Number(z[3] ?? 0)) : 0;
  }
  return { hour, minute: Number(m[2]), second: Number(m[3] ?? 0), offset };
}

interface Day {
  year: number;
  month: number;
  day: number;
}

/** The day at the start of `text` and what follows it, for each way a day is written; null for none. */
function readDay(text: string, order: DateOrder): { day: Day; rest: string } | null {
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?=$|[T\s,])/.exec(text);
  if (m) return { day: { year: +m[1], month: +m[2], day: +m[3] }, rest: text.slice(m[0].length) };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?=$|[T\s,])/.exec(text);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return { day: { year: +m[3], month: order === 'dmy' ? b : a, day: order === 'dmy' ? a : b }, rest: text.slice(m[0].length) };
  }
  // 14 Mar 2026, 14 March 2026
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?,?[\s-]+(\d{4})(?=$|[T\s,])/i.exec(text);
  const month = m ? MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) : -1;
  if (m && month >= 0) return { day: { year: +m[3], month: month + 1, day: +m[1] }, rest: text.slice(m[0].length) };
  // Mar 14, 2026
  m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?=$|[T\s,])/i.exec(text);
  const named = m ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
  if (m && named >= 0) return { day: { year: +m[3], month: named + 1, day: +m[2] }, rest: text.slice(m[0].length) };
  return null;
}

/**
 * A date, a time or a timestamp as SQL writes it (`2026-03-14`, `09:05:00`, `2026-03-14 09:05:00`);
 * null when the text is none that exists. The days it reads: `2026-03-14`, `2026/03/14`,
 * `14/03/2026`, `14-03-2026`, `14.03.2026` (the order of the two numbers is `order`) and
 * `14 Mar 2026` / `March 14, 2026`, each alone or with a time after it (`T` or a space between,
 * 12 or 24 hours). A day alone is midnight. A timestamp that names a time zone is moved to UTC,
 * which is what the rest of the app writes; a date or a time keeps what the text says.
 */
export function parseMoment(kind: Moment, text: string, order: DateOrder = 'dmy'): string | null {
  const s = text.trim();
  if (kind === 'time') {
    const c = readClock(s);
    const out = c && `${pad(c.hour)}:${pad(c.minute)}:${pad(c.second)}`;
    return out && validMoment('time', out) ? out : null;
  }
  const read = readDay(s, order);
  if (!read) return null;
  const { day, rest } = read;
  const clock = rest.trim() === '' ? { hour: 0, minute: 0, second: 0, offset: null } : readClock(rest.replace(/^[T,\s]+/, ''));
  if (!clock) return null;
  const date = `${pad(day.year, 4)}-${pad(day.month)}-${pad(day.day)}`;
  const local = `${date} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`;
  if (!validMoment('timestamp', local)) return null;
  if (kind === 'date') return date;
  if (!clock.offset) return local;
  return formatMoment(Date.UTC(day.year, day.month - 1, day.day, clock.hour, clock.minute, clock.second) - clock.offset * 60000, 'timestamp');
}

/**
 * How a column of dates writes `03/04/2026`: month first when some cell has a month where the
 * day would be (`04/13/2026`), day first otherwise, including when no cell tells.
 */
export function detectDateOrder(cells: readonly SourceCell[]): DateOrder {
  let monthFirst = false;
  for (const cell of cells) {
    const m = typeof cell === 'string' ? /^\s*(\d{1,2})[-/.](\d{1,2})[-/.]\d{4}/.exec(cell) : null;
    if (!m) continue;
    if (+m[1] > 12) return 'dmy';
    if (+m[2] > 12) monthFirst = true;
  }
  return monthFirst ? 'mdy' : 'dmy';
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * A number as a file writes it: `1234.5`, `1,234.50`, `1.234,50`, `12,5`; the text with a dot for
 * the decimals and no thousands separators, or null when it is no number. A lone `1,234` is
 * a thousand two hundred and thirty-four, and a lone `1.234` is one and 234 thousandths.
 */
export function normalizeNumber(text: string): string | null {
  const s = text.trim().replace(/^([+-]?)\s+/, '$1');
  if (NUMBER.test(s)) return s;
  const sign = /^[+-]/.test(s) ? s[0] : '';
  const body = sign ? s.slice(1) : s;
  let plain: string | null = null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(body)) plain = body.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(body)) plain = body.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d+$/.test(body) && !/^\d{1,3},\d{3}$/.test(body)) plain = body.replace(',', '.');
  return plain === null ? null : sign + plain;
}

const TRUE_WORDS = ['true', 't', 'yes', 'y', '1', 'on'];
const FALSE_WORDS = ['false', 'f', 'no', 'n', '0', 'off'];

const problem = (kind: ConvertProblemKind, message: string): Converted['problem'] => ({ kind, message });

/**
 * One cell of a file as the value of column `c`. An empty cell is NULL where the column may be
 * empty, the default where it has one, and a problem otherwise. A number comes as a number
 * (`1,234.50` too), a yes as a boolean, a date as a timestamp, a date or a time by the type of the
 * column. Text keeps its spaces.
 */
export function convertValue(c: Column, meta: FieldMeta, raw: SourceCell | undefined, o: ConvertOptions): Converted {
  const textual = isTextField(meta) || meta.kind === 'enum' || (meta.kind === 'reference' && cellKind(c.type) === 'text');
  const blank = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '' && (o.emptyNull || !textual));
  if (blank) {
    if (c.nullable && !c.pk) return { value: null };
    if (c.default) return { value: undefined };
    return { value: null, problem: problem('required', t('import.problem.required', { name: c.name })) };
  }
  const text = typeof raw === 'string' ? raw : String(raw);
  const wrong = (kind: ConvertProblemKind, message: string): Converted => ({ value: raw, problem: problem(kind, message) });

  if (meta.kind === 'number' || (meta.kind === 'reference' && cellKind(c.type) === 'number')) {
    const plain = typeof raw === 'number' ? String(raw) : normalizeNumber(text);
    const n = plain === null ? NaN : Number(plain);
    if (!Number.isFinite(n)) return wrong('type', t('record.problem.number'));
    if (isIntegerType(c.type) && !Number.isInteger(n)) return wrong('type', t('record.problem.whole'));
    const scale = typeScale(c.type);
    // 12.500 has two decimals where the database counts them.
    const decimals = (plain ?? '').replace(/e.*$/i, '').split('.')[1]?.replace(/0+$/, '') ?? '';
    if (scale !== null && decimals.length > scale) return wrong('type', t('record.problem.decimals', { scale }));
    return { value: n };
  }
  if (meta.kind === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    const w = text.trim().toLowerCase();
    if (TRUE_WORDS.includes(w)) return { value: true };
    if (FALSE_WORDS.includes(w)) return { value: false };
    return wrong('type', t('record.problem.boolean'));
  }
  if (meta.kind === 'time') {
    const moment = parseMoment(meta.moment, text, o.dateOrder);
    return moment ? { value: moment } : wrong('date', t(`record.problem.${meta.moment}`));
  }
  if (meta.kind === 'json') {
    const parsed = parseJson(text);
    return parsed.ok ? { value: text } : wrong('type', t('record.problem.json', { line: parsed.line }));
  }
  if (meta.kind === 'enum' && meta.fixed && !meta.options.includes(text)) {
    return wrong('type', t('record.problem.enum', { values: meta.options.join(', ') }));
  }
  const max = typeLength(c.type);
  if (max !== null && text.length > max) return wrong('type', t('record.problem.length', { max }));
  return { value: text };
}
