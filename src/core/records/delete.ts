import type { OnDelete, Table } from '../model';
import { incomingRelations } from '../relations';
import type { RecordData } from './fields';
import type { Row } from '.';

// What deleting rows does to the rows of other tables, by the rule of each foreign key that points
// at them. Pure TS: it plans the change and leaves writing it to the caller.

/** What a delete does through one foreign key: the rows it reaches, and the rule that decides. */
export interface DeleteEffect {
  /** The table whose rows are reached, and the column of its foreign key. */
  table: string;
  column: string;
  count: number;
  rule: OnDelete;
  /** The delete cannot go on: the rule is RESTRICT or NO ACTION, or SET NULL on a column that cannot be NULL. */
  blocked: boolean;
}

export interface DeletePlan {
  /** Each foreign key that has rows behind it, those reached through cascades included. */
  effects: DeleteEffect[];
  /** Some effect is blocked; `changes` is then empty. */
  blocked: boolean;
  /** The rows of every table the delete changes, as they are after it: the rows deleted gone, the rows set to NULL changed. */
  changes: Record<string, Row[]>;
}

/**
 * Plans the deletion of `deleted`, rows of `table` that are in `data`. ON DELETE CASCADE takes the
 * rows that point at them along (and the rows that point at those), ON DELETE SET NULL sets the
 * column to NULL, anything else blocks. A row is known by the object in `data`.
 */
export function planDelete(tables: readonly Table[], data: RecordData, table: string, deleted: readonly Row[]): DeletePlan {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const gone = new Map<string, Set<Row>>([[table, new Set(deleted)]]);
  const nulled = new Map<string, Map<Row, Set<string>>>();
  const effects = new Map<string, DeleteEffect>();

  const visit = (name: string, rows: readonly Row[]) => {
    const own = byName.get(name);
    if (!own) return;
    for (const r of incomingRelations(own, tables)) {
      const keys = new Set(rows.filter((x) => x[r.to.column] != null).map((x) => String(x[r.to.column])));
      const there = r.from.table;
      const child = byName.get(there);
      const taken = gone.get(there);
      const reached = (data[there] ?? []).filter((x) => !taken?.has(x) && x[r.from.column] != null && keys.has(String(x[r.from.column])));
      if (!reached.length || !child) continue;

      const column = child.columns.find((c) => c.name === r.from.column);
      const blocked = r.onDelete === 'SET NULL' ? !column?.nullable : r.onDelete !== 'CASCADE';
      const id = `${there}.${r.from.column}`;
      const seen = effects.get(id);
      effects.set(id, { table: there, column: r.from.column, count: (seen?.count ?? 0) + reached.length, rule: r.onDelete, blocked: (seen?.blocked ?? false) || blocked });
      if (blocked) continue;

      if (r.onDelete === 'CASCADE') {
        const set = gone.get(there) ?? new Set<Row>();
        gone.set(there, set);
        reached.forEach((x) => set.add(x));
        visit(there, reached);
      } else {
        const marks = nulled.get(there) ?? new Map<Row, Set<string>>();
        nulled.set(there, marks);
        for (const x of reached) marks.set(x, (marks.get(x) ?? new Set()).add(r.from.column));
      }
    }
  };
  visit(table, deleted);

  const list = [...effects.values()];
  const blocked = list.some((e) => e.blocked);
  const changes: Record<string, Row[]> = {};
  if (!blocked) {
    for (const name of new Set([...gone.keys(), ...nulled.keys()])) {
      changes[name] = (data[name] ?? [])
        .filter((x) => !gone.get(name)?.has(x))
        .map((x) => {
          const cols = nulled.get(name)?.get(x);
          return cols ? { ...x, ...Object.fromEntries([...cols].map((c) => [c, null])) } : x;
        });
    }
  }
  return { effects: list, blocked, changes };
}
