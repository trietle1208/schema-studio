import type { Table } from '../model';
import { mysqlParser } from './mysql';
import { postgresParser } from './postgres';

/** Why a script could not be imported. Only the first problem is reported. */
export interface ParseError {
  /** What happened, in the wording of the design system: "Unable to parse SQL near line 42." */
  message: string;
  /** The line to go to, counted from 1. */
  line: number;
  /** What was expected, or how to fix it. Names are wrapped in backticks. */
  detail?: string;
}

export interface ParseResult {
  tables: Table[];
  /** What was left out or changed on the way in. Names are wrapped in backticks. */
  warnings: string[];
  /** How many statements were passed over because they do not define tables. */
  skipped: number;
}

export type ParseOutcome = ({ ok: true } & ParseResult) | { ok: false; error: ParseError };

/** Reads the DDL of one database engine into the model. */
export interface SqlParser {
  /** The engine as schemas name it: `PostgreSQL`. */
  engine: string;
  /** Never throws: a script that cannot be read gives an error with its line. */
  parse: (sql: string) => ParseOutcome;
}

const PARSERS: readonly SqlParser[] = [postgresParser, mysqlParser];

/** The parser for an engine, or null when its DDL cannot be imported yet. */
export function parserFor(engine: string): SqlParser | null {
  return PARSERS.find((p) => p.engine === engine) ?? null;
}

/** The engines whose DDL can be imported. */
export const IMPORT_ENGINES: readonly string[] = PARSERS.map((p) => p.engine);
