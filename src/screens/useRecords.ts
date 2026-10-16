import { useEffect, useState } from 'react';
import type { Row } from '../core/records';
import { readRecords } from '../db/records';
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
}

/**
 * The rows of `table` of the schema stored as `schemaId` (null while it is not stored), for the Data
 * mode. They are read from the database when the table is opened and again on `reload`; the tables
 * of the schema are only looked at then, as a table edited on the diagram changes what the next
 * read draws, not the rows already there.
 */
export function useRecords(schemaId: number | null, table: string): RecordsState {
  const [loaded, setLoaded] = useState<{ table: string; rows: Row[] } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [reads, setReads] = useState(0);

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

  return {
    rows: loaded?.table === table ? loaded.rows : null,
    counts,
    failed: failed === table,
    reload: () => {
      setLoaded(null);
      setReads((n) => n + 1);
    },
  };
}
