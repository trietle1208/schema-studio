import { useEffect, useState } from 'react';
import type { Row } from '../core/records';
import type { RecordData } from '../core/records/fields';
import { changeRecords, readAllRecords } from '../db/records';
import { useSchemaStore } from '../store/schema';

export interface AllRecordsState {
  /** The rows of every table; null while they are being read. */
  data: RecordData | null;
  /** The rows could not be read from the database. */
  failed: boolean;
  /** Reads them again. */
  reload: () => void;
  /**
   * Changes the rows of one table as `useRecords` does: `change` is given the rows as stored and
   * returns the rows to store. Resolves with what was stored; rejects, with nothing written, when
   * `change` throws or the database does not take them.
   */
  change: (table: string, change: (rows: Row[]) => Row[]) => Promise<Row[]>;
}

/**
 * The rows of every table of the schema stored as `schemaId`, for Query mode, which runs over all
 * of them. They are read when the mode opens and again on `reload`; the tables are looked at then.
 */
export function useAllRecords(schemaId: number | null): AllRecordsState {
  const [data, setData] = useState<RecordData | null>(null);
  const [failed, setFailed] = useState(false);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let live = true;
    readAllRecords(schemaId, useSchemaStore.getState().tables).then(
      (read) => {
        if (!live) return;
        setData(read);
        setFailed(false);
      },
      (error) => {
        if (!live) return;
        console.error(error);
        setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [schemaId, reads]);

  return {
    data,
    failed,
    reload: () => {
      setData(null);
      setFailed(false);
      setReads((n) => n + 1);
    },
    change: async (table, change) => {
      if (schemaId === null) throw new Error('The schema is not stored: its records cannot be changed.');
      const next = await changeRecords(schemaId, table, change);
      setData((cur) => (cur ? { ...cur, [table]: next } : cur));
      return next;
    },
  };
}
