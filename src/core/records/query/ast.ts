// The SELECT that Query mode reads, prints and runs. Pure data: `parse.ts` makes it from text,
// `spec.ts` from what the Builder holds, `print.ts` writes it out and `run.ts` runs it.

/** A column named in the query. `line` is where it stands in the SQL it was read from. */
export interface ColumnRef {
  t: 'col';
  name: string;
  /** The table in `users.name`. */
  qual?: string;
  alias?: string;
  line?: number;
}

export type Literal =
  | { t: 'lit'; kind: 'num'; v: number; line?: number }
  | { t: 'lit'; kind: 'str'; v: string; line?: number }
  | { t: 'lit'; kind: 'bool'; v: boolean; line?: number }
  | { t: 'lit'; kind: 'null'; v: null; line?: number };

export type Operand = ColumnRef | Literal;

export type Expr =
  | { t: 'and'; a: Expr; b: Expr }
  | { t: 'or'; a: Expr; b: Expr }
  | { t: 'not'; e: Expr }
  | { t: 'cmp'; op: '=' | '<>' | '<' | '>' | '<=' | '>='; l: Operand; r: Operand }
  | { t: 'like'; ci: boolean; neg: boolean; l: Operand; r: Operand }
  | { t: 'isnull'; neg: boolean; l: Operand }
  | { t: 'between'; neg: boolean; l: Operand; a: Operand; b: Operand }
  | { t: 'in'; neg: boolean; l: Operand; list: Operand[] };

export interface OrderBy {
  col: ColumnRef;
  dir: 'ASC' | 'DESC';
}

/** `SELECT cols FROM table WHERE … ORDER BY … LIMIT … OFFSET …`. `cols` is null for `*`. */
export interface Select {
  cols: ColumnRef[] | null;
  table: string;
  /** The line the table is named on. */
  tableLine?: number;
  /** The schema in `public.users`. */
  schema?: string | null;
  where: Expr | null;
  order: OrderBy[];
  limit: number | null;
  offset: number | null;
}
