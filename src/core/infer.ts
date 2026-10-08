import type { Column, Table } from './model';
import { referenceTargets, type ColumnRef } from './relations';

// Guesses the foreign keys a database does not declare from the names of its columns. Many schemas
// have none: the application joins `orders.user_id` to `users.id` and the database is never told.
//
// A column is tied to a table by its name, in one of these ways:
//
//   orders.user_id        → users.id            the table's name, then the last word of its key
//   de_xuat_lich_su.ma_de_xuat → de_xuat.id     a word for a key (`id`, `ma`), then the table's name
//   to_trinh.danh_muc_id  → to_trinh_danh_muc.id  the end of the name of the only such table
//   order_items.order_no  → orders.order_no     the name of a key that is called after its table
//   categories.parent_id  → categories.id       `parent`, then the last word of the table's own key
//
// Words before the name are let through (`created_by_user_id`), plurals are matched both ways
// (`category_id` → `categories`), and so are names in camel case (`userId`) or run together
// (`userid`). A prefix that every table has (`wp_posts`, `wp_users`) is looked past.
//
// The reference ends at the table's primary key when that is one column of the same kind of value.
// Where it is not, it ends at a column the table is looked up by that is called after the table,
// as the code `bieu_mau.ma_bieu_mau` is next to a numeric `id`. A column that fits two tables
// equally well is left alone: no line is better than a wrong one.

/** A foreign key that is not declared: `from` is the column that was named after `to`. */
export interface InferredRelation {
  from: ColumnRef;
  to: ColumnRef;
}

/** A table as columns name it. */
interface Named {
  table: Table;
  /** The words of its name, without the prefix every table has. */
  name: string[];
  /** Its primary key, when that is one column. */
  primary?: Key;
}

/** A column that other tables can reference, with the words of its name. */
interface Key {
  owner: Named;
  column: Column;
  words: string[];
}

/** One way a column fits a table: the column of the table it would reference, and how well. */
interface Fit {
  key: Key;
  how: number;
}

// How well a column fits a table. The best fit wins; two tables that fit equally well are a tie.
/** The end of the name of a table: `danh_muc_id` for `to_trinh_danh_muc`. */
const TABLE_END = 1;
/** Words before the name of a key: `author_order_no`. */
const KEY_AFTER_WORDS = 2;
/** Words before the name of the table (`created_by_user_id`), `parent_id` for the table itself, or the end of the name of a table that is called after this one. */
const TABLE_AFTER_WORDS = 3;
/** The name of a key that is called after its table: `order_no`. */
const KEY = 4;
/** The name of the table with the word for its key: `user_id`, `ma_de_xuat`. */
const TABLE = 5;

const PARENT = 'parent';
/** What a column is called next to a `…_id` that can point at any table: `commentable_id`, `commentable_type`. */
const POLYMORPHIC = 'type';
/** The words for a key that go before the name of a table: `id_usuario`, and `ma` in Vietnamese schemas (`ma_don_hang`). */
const LEADING_KEY_WORDS = new Set(['id', 'ma']);

/** The words of a name in lower case: `comment_post_ID`, `commentPostId` → comment, post, id. */
function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** A word and what it may be the plural of: `categories` → categories, category, categorie. */
function singulars(word: string): string[] {
  const forms = [word];
  if (word.endsWith('ies') && word.length > 3) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es') && word.length > 2) forms.push(word.slice(0, -2));
  if (word.endsWith('s') && word.length > 1) forms.push(word.slice(0, -1));
  return forms;
}

/** The ways a name of several words is written when only its last word may be a plural: `order_items`, `order_item`. */
function forms(name: readonly string[]): string[] {
  const start = name.slice(0, -1);
  return singulars(name[name.length - 1]).map((last) => [...start, last].join('_'));
}

const INTEGERS = /^(?:(?:TINY|SMALL|MEDIUM|BIG)?INT|INTEGER|INT[248]|(?:SMALL|BIG)?SERIAL|SERIAL[248])$/;
const TEXTS = /^(?:N?(?:VAR)?CHAR|CHARACTER(?: VARYING)?|BPCHAR|CITEXT|(?:TINY|MEDIUM|LONG)?TEXT)$/;

/** The kind of value a type holds, whatever its size: every integer is one kind, every text another. */
function typeFamily(type: string): string {
  const name = type
    .toUpperCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(?:UNSIGNED|SIGNED|ZEROFILL|AUTO_INCREMENT)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (INTEGERS.test(name)) return 'integer';
  if (TEXTS.test(name)) return 'text';
  if (name === 'NUMERIC' || name === 'DECIMAL') return 'decimal';
  return name;
}

/** A way the words of a column split into the name of a table and a word for its key. */
interface Split {
  stem: string[];
  /** The last word the key of the table must have; null when the word went before the name and says nothing of it. */
  keyWord: string | null;
  /** Whether the stem is the whole name of the table, so that no word of it may be passed over. */
  whole: boolean;
}

/** `user_id`, `userid` for the key word `id`, and `ma_de_xuat`. */
function splits(name: readonly string[], keyWords: ReadonlySet<string>): Split[] {
  const last = name[name.length - 1];
  const found: Split[] = name.length > 1 ? [{ stem: name.slice(0, -1), keyWord: last, whole: false }] : [];
  for (const keyWord of keyWords) {
    if (last.length > keyWord.length && last.endsWith(keyWord)) {
      found.push({ stem: [...name.slice(0, -1), last.slice(0, -keyWord.length)], keyWord, whole: false });
    }
  }
  if (name.length > 1 && LEADING_KEY_WORDS.has(name[0])) found.push({ stem: name.slice(1), keyWord: null, whole: true });
  return found;
}

const lastOf = (list: readonly string[]) => list[list.length - 1];
const distinct = <T>(list: readonly T[]) => [...new Set(list)];

/** The foreign keys the names of the columns of `tables` point to, for the columns that have none. */
export function inferRelations(tables: readonly Table[]): InferredRelation[] {
  const all = tables.map((table) => ({ table, full: words(table.name) })).filter((t) => t.full.length > 0);
  // A first word that every table has says nothing about any of them.
  const prefixed = all.length > 1 && all.every((t) => t.full.length > 1 && t.full[0] === all[0].full[0]);

  const named = new Map<Table, Named>();
  /** The tables by every way their name may be written in a column. */
  const byName = new Map<string, Named[]>();
  /** The tables by every way the end of their name may be written, with the words before it. */
  const byEnd = new Map<string, { table: Named; start: string[] }[]>();
  /** The columns that are called after their table, by their name. */
  const byKey = new Map<string, Key[]>();
  const keyWords = new Set<string>();
  const add = <T>(map: Map<string, T[]>, key: string, value: T) => map.set(key, [...(map.get(key) ?? []), value]);

  for (const { table, full } of all) {
    const owner: Named = { table, name: prefixed ? full.slice(1) : full };
    named.set(table, owner);
    const names = distinct([...forms(full), ...forms(owner.name)]);
    for (const form of names) add(byName, form, owner);
    for (let from = 1; from < owner.name.length; from++) {
      for (const form of forms(owner.name.slice(from))) add(byEnd, form, { table: owner, start: owner.name.slice(0, from) });
    }

    const keys = table.columns.filter((c) => c.pk);
    for (const column of table.columns) {
      const key: Key = { owner, column, words: words(column.name) };
      if (!key.words.length) continue;
      if (column.pk && keys.length === 1) {
        owner.primary = key;
        keyWords.add(lastOf(key.words));
        // `order_no` and `orderid` say which table they are the key of; `id` and `code` are the key of many.
        const joined = key.words.join('');
        const specific =
          key.words.length > 1 ||
          names.some((form) => {
            const start = form.replace(/_/g, '');
            return joined.length > start.length && joined.startsWith(start);
          });
        if (specific) add(byKey, key.words.join('_'), key);
      } else if (!column.pk && key.words.length > 1) {
        // A code next to the id: called after the table, and what the table is looked up by.
        const lookedUp = column.unique || (table.indexes ?? []).some((index) => index.columns[0] === column.name);
        const after = names.includes(key.words.slice(0, -1).join('_'));
        const before = LEADING_KEY_WORDS.has(key.words[0]) && names.includes(key.words.slice(1).join('_'));
        if (lookedUp && (after || before)) add(byKey, key.words.join('_'), key);
      }
    }
  }

  const relations: InferredRelation[] = [];
  for (const table of tables) {
    const own = named.get(table);
    const columnNames = new Set(table.columns.map((c) => words(c.name).join('_')));
    for (const column of table.columns) {
      const name = words(column.name);
      if (column.fk || !name.length) continue;
      // An id next to a type is a reference to whichever table the type names.
      if (name.length > 1 && columnNames.has([...name.slice(0, -1), POLYMORPHIC].join('_'))) continue;

      const fits = new Map<Named, Fit[]>();
      const fit = (key: Key | undefined, how: number) => {
        if (key) fits.set(key.owner, [...(fits.get(key.owner) ?? []), { key, how }]);
      };

      for (const { stem, keyWord, whole } of splits(name, keyWords)) {
        const keyed = (found: readonly Named[]) =>
          distinct(found).filter((t) => t.primary && (keyWord === null || lastOf(t.primary.words) === keyWord));
        let found: Named[] = [];
        // The longest name wins: `order_item_id` is an order item before it is an item.
        for (let skipped = 0; skipped < (whole ? 1 : stem.length) && !found.length; skipped++) {
          found = keyed(forms(stem.slice(skipped)).flatMap((form) => byName.get(form) ?? []));
          for (const t of found) fit(t.primary, skipped === 0 ? TABLE : TABLE_AFTER_WORDS);
        }
        if (!found.length) {
          const ends = forms(stem).flatMap((form) => byEnd.get(form) ?? []);
          for (const t of keyed(ends.map((end) => end.table))) {
            // `danh_muc_id` in `to_trinh` is the `to_trinh_danh_muc` before it is any other `…_danh_muc`.
            const ownStart = !!own && ends.some((end) => end.table === t && forms(end.start).some((form) => forms(own.name).includes(form)));
            if (t !== own) fit(t.primary, ownStart ? TABLE_AFTER_WORDS : TABLE_END);
          }
        }
        if (own && stem.length === 1 && stem[0] === PARENT) for (const t of keyed([own])) fit(t.primary, TABLE_AFTER_WORDS);
      }
      for (let skipped = 0; skipped < name.length; skipped++) {
        const found = byKey.get(name.slice(skipped).join('_'));
        if (!found) continue;
        for (const key of found) fit(key, skipped === 0 ? KEY : KEY_AFTER_WORDS);
        break;
      }

      const scores = [...fits].map(([found, ways]) => ({ found, ways, how: Math.max(...ways.map((way) => way.how)) }));
      const best = Math.max(0, ...scores.map((score) => score.how));
      const [target, ...others] = scores.filter((score) => score.how === best);
      // Nothing fits, or two tables fit equally well.
      if (!target || others.length) continue;
      // A column that is called after its own table is what others reference, not a reference.
      if (target.found === own && best >= KEY) continue;
      const kind = typeFamily(column.type);
      const to = [...target.ways]
        .sort((a, b) => b.how - a.how)
        .find((way) => way.key.column !== column && typeFamily(way.key.column.type) === kind);
      if (!to) continue;
      relations.push({
        from: { table: table.name, column: column.name },
        to: { table: target.found.table.name, column: to.key.column.name },
      });
    }
  }
  return relations;
}

/**
 * The foreign key `table` is most likely to be given next, which "Add foreign key" starts from: its
 * first inferred one that is yet to be declared, or else the first one the names of its columns
 * point to. Only one that can be declared counts, to the primary key of another table. Null when
 * the names say nothing.
 */
export function suggestForeignKey(table: Table, tables: readonly Table[]): InferredRelation | null {
  const targets = referenceTargets(table, tables);
  const declarable = (to: ColumnRef) => targets.some((t) => t.table === to.table && t.column === to.column);
  const inferred = table.columns.find((c) => c.fk?.inferred && declarable(c.fk));
  if (inferred?.fk) {
    return { from: { table: table.name, column: inferred.name }, to: { table: inferred.fk.table, column: inferred.fk.column } };
  }
  return inferRelations(tables).find((r) => r.from.table === table.name && declarable(r.to)) ?? null;
}

/**
 * `tables` with the foreign keys `inferRelations` finds, each marked as inferred. A table that
 * gets none is itself, and so are `tables` when there is nothing to add.
 */
export function addInferred(tables: Table[]): Table[] {
  const found = new Map(inferRelations(tables).map((r) => [`${r.from.table}.${r.from.column}`, r.to]));
  if (!found.size) return tables;
  return tables.map((table) => {
    if (!table.columns.some((c) => found.has(`${table.name}.${c.name}`))) return table;
    return {
      ...table,
      columns: table.columns.map((c) => {
        const to = found.get(`${table.name}.${c.name}`);
        return to ? { ...c, fk: { table: to.table, column: to.column, inferred: true } } : c;
      }),
    };
  });
}
