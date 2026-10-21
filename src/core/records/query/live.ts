import type { LiveRow } from '../../introspect/catalog';
import type { Column, Table } from '../../model';
import type { Row } from '..';
import type { Select } from './ast';
import type { QueryRun } from './run';

// A live SELECT comes back as column names and cells. This turns that into the same result the
// grid reads when a query runs over rows kept in the browser. Nothing here is opened in the
// record editor: the rows belong to the database.

/** The column the grid should show for a name the database returned. */
function columnFor(name: string, tables: readonly Table[]): Column {
  const dot = name.indexOf('.');
  if (dot > 0) {
    const table = tables.find((item) => item.name === name.slice(0, dot));
    const column = table?.columns.find((item) => item.name === name.slice(dot + 1));
    if (column) return { ...column, name, pk: false, fk: null };
  }
  const hits = tables.flatMap((table) => table.columns.filter((column) => column.name === name));
  return hits.length === 1 ? hits[0] : { name, type: 'text' };
}

/** The rows the bridge returned, as a query result. `sources` is empty: a live row is not edited here. */
export function liveRun(
  query: Select,
  answer: { columns: readonly string[]; rows: readonly LiveRow[]; capped: boolean; plan: readonly string[] },
  tables: readonly Table[],
  sql: string,
): QueryRun {
  const table = tables.find((item) => item.name === query.table) ?? { name: query.table, columns: [] };
  const columns = answer.columns.map((name) => columnFor(name, tables));
  const rows = answer.rows.map((row) => {
    const out: Row = {};
    for (const name of answer.columns) out[name] = row[name] ?? null;
    return out;
  });
  return {
    ok: true,
    table,
    columns,
    rows,
    sources: [],
    total: rows.length,
    shown: rows.length,
    capped: answer.capped,
    removed: 0,
    all: rows.length,
    query,
    sql,
    plan: [...answer.plan],
  };
}
