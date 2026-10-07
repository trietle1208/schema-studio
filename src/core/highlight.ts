// Syntax highlighting for the SQL editor: text in, runs of text with a kind out. The editor draws
// each kind in its `syn-*` colour. The keyword and type lists are those of the design system.

export type SyntaxKind = 'keyword' | 'type' | 'string' | 'number' | 'comment';

/** A run of text that is drawn in one colour. Plain text has no kind. */
export interface SyntaxToken {
  text: string;
  kind?: SyntaxKind;
}

const KEYWORDS =
  'CREATE|TABLE|PRIMARY|KEY|NOT|NULL|UNIQUE|DEFAULT|REFERENCES|ON|DELETE|UPDATE|CASCADE|RESTRICT|SET|INDEX|ALTER|ADD|COLUMN|DROP|IF|EXISTS|CONSTRAINT|FOREIGN|CHECK|USING|BEGIN|COMMIT|TYPE|IN|AND|OR|INSERT|INTO|VALUES|SELECT|FROM|WHERE|NO|ACTION|COMMENT|IS|RENAME|TO';
const TYPES =
  'BIGSERIAL|SERIAL|SMALLSERIAL|BIGINT|INTEGER|INT|SMALLINT|DECIMAL|NUMERIC|VARCHAR|CHAR|TEXT|BOOLEAN|BOOL|TIMESTAMPTZ|TIMESTAMP|DATE|TIME|UUID|JSONB|JSON|BYTEA|REAL|DOUBLE|PRECISION|INET|DateTime|UInt64|UInt32|String|Float64';

const SQL = new RegExp(`(--[^\\n]*)|('(?:[^'\\\\]|\\\\.)*'?)|\\b(${KEYWORDS})\\b|\\b(${TYPES})\\b|\\b(\\d+(?:\\.\\d+)?)\\b`, 'gi');
const SQL_KINDS: SyntaxKind[] = ['comment', 'string', 'keyword', 'type', 'number'];

// The first group is a key: a string followed by a colon. It has no kind, so it stays plain.
const JSON_TOKEN = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*"?)|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
const JSON_KINDS: (SyntaxKind | undefined)[] = [undefined, 'string', 'keyword', 'number'];

/** Cuts `source` into runs: a match has the kind of its group, and everything else is plain. */
function tokenize(source: string, pattern: RegExp, kinds: (SyntaxKind | undefined)[]): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const kind = kinds[match.slice(1).findIndex((group) => group !== undefined)];
    if (!match[0] || !kind) continue;
    if (match.index > last) tokens.push({ text: source.slice(last, match.index) });
    tokens.push({ text: match[0], kind });
    last = match.index + match[0].length;
  }
  if (last < source.length) tokens.push({ text: source.slice(last) });
  return tokens;
}

export function highlightSql(source: string): SyntaxToken[] {
  return tokenize(source, SQL, SQL_KINDS);
}

export function highlightJson(source: string): SyntaxToken[] {
  return tokenize(source, JSON_TOKEN, JSON_KINDS);
}
