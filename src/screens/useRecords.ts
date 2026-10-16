import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { seedRecords, type Row } from '../core/records';
import type { RecordData } from '../core/records/fields';
import { changeRecords, readAllRecords, readRecords, writeRecords } from '../db/records';
import { useSchemaStore } from '../store/schema';

export interface RecordsState {
  /** The rows of the table asked for; null while they are being read. */
  rows: Row[] | null;
  /** How many rows each table has. Kept from the tables read before, so the list never loses its numbers while one is read. */
  counts: Record<string, number>;
  /** The rows could not be read from the database. */
  failed: boolean;
  /** Reads them again. */
  reload: () => void;
  /**
   * Changes the rows of the table: `change` is given the rows as stored and returns the rows to
   * store (see `core/records/rows`). Resolves with what was stored; rejects, with nothing written,
   * when `change` throws or the database does not take them.
   */
  change: (change: (rows: Row[]) => Row[]) => Promise<Row[]>;
  /** Replaces the rows of several tables, this one or others, in one write. Resolves with the rows each had before, to write back for an undo. */
  write: (rows: Readonly<Record<string, Row[]>>) => Promise<Record<string, Row[]>>;
  /** The rows of every table, for the editor; the table on screen gives the rows that are on screen. */
  readData: () => Promise<RecordData>;
}

/**
 * The rows of `table` of the schema stored as `schemaId` (null while it is not stored), for the Data
 * mode. They are read from the database when the table is opened and again on `reload`; the tables
 * of the schema are only looked at then, as a table edited on the diagram changes what the next
 * read draws, not the rows already there.
 *
 * A schema that is not stored has no database to keep changes in: its rows can be read, drawn
 * again each time, but `change` and `write` refuse. (Every schema the app routes to is stored.)
 */
export function useRecords(schemaId: number | null, table: string): RecordsState {
  const [loaded, setLoaded] = useState<{ table: string; rows: Row[] } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [reads, setReads] = useState(0);
  const shown = useRef<Row[] | null>(null);

  useEffect(() => {
    let live = true;
    readRecords(schemaId, useSchemaStore.getState().tables, table).then(
      (read) => {
        if (!live) return;
        setLoaded({ table, rows: read.rows });
        setCounts(read.counts);
        setFailed(null);
      },
      (error) => {
        if (!live) return;
        console.error(error);
        setFailed(table);
      },
    );
    return () => {
      live = false;
    };
  }, [schemaId, table, reads]);

  const rows = loaded?.table === table ? loaded.rows : null;
  useLayoutEffect(() => {
    shown.current = rows;
  });

  // What was stored is what the screen shows from then on, and the list's counts follow.
  const show = (written: Record<string, Row[]>) => {
    setLoaded((cur) => (cur && written[cur.table] ? { table: cur.table, rows: written[cur.table] } : cur));
    setCounts((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(written).map(([name, list]) => [name, list.length])) }));
  };

  return {
    rows,
    counts,
    failed: failed === table,
    reload: () => {
      setLoaded(null);
      setReads((n) => n + 1);
    },
    change: async (change) => {
      if (schemaId === null) throw new Error('The schema is not stored: its records cannot be changed.');
      const next = await changeRecords(schemaId, table, change);
      show({ [table]: next });
      return next;
    },
    write: async (written) => {
      if (schemaId === null) throw new Error('The schema is not stored: its records cannot be changed.');
      const before = await writeRecords(schemaId, written);
      show({ ...written });
      return before;
    },
    readData: async () => {
      const tables = useSchemaStore.getState().tables;
      const all = schemaId === null ? seedRecords(tables, 0) : await readAllRecords(schemaId, tables);
      return shown.current ? { ...all, [table]: shown.current } : all;
    },
  };
}
