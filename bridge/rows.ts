// The SELECT the bridge builds for one page of a MySQL table. The page never sends SQL: a table
// name, a column list and a limit are checked here, then quoted. Anything else is refused.

/** A table or column name the bridge will quote. Anything else could change the statement. */
export const IDENTIFIER = /^[A-Za-z0-9_]+$/;

/** The most rows one page may ask for. */
export const MAX_ROW_LIMIT = 200;

export interface RowsQuery {
  table: string;
  columns: string[];
  /** 1..200. */
  limit: number;
  /** Zero or more. */
  offset: number;
  orderBy?: { column: string; dir: 'asc' | 'desc' };
}

const quote = (name: string) => `\`${name}\``;

/**
 * The statements that read one page and the row count, or null when the query is not one the
 * bridge will run. `limit` and `offset` stay as placeholders.
 */
export function mysqlRowsSql(query: RowsQuery): { select: string; count: string } | null {
  if (!IDENTIFIER.test(query.table)) return null;
  if (query.columns.length === 0 || query.columns.some((column) => !IDENTIFIER.test(column))) return null;
  if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > MAX_ROW_LIMIT) return null;
  if (!Number.isSafeInteger(query.offset) || query.offset < 0) return null;
  const order = query.orderBy;
  if (order) {
    if (!query.columns.includes(order.column) || (order.dir !== 'asc' && order.dir !== 'desc')) return null;
  }
  const table = quote(query.table);
  const columns = query.columns.map(quote).join(', ');
  const ordering = order ? ` ORDER BY ${quote(order.column)} ${order.dir === 'desc' ? 'DESC' : 'ASC'}` : '';
  return {
    select: `SELECT ${columns} FROM ${table}${ordering} LIMIT ? OFFSET ?`,
    count: `SELECT COUNT(*) AS total FROM ${table}`,
  };
}
