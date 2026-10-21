import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readRows } from '../bridge/client';
import type { BridgeError } from '../core/introspect/catalog';
import { connectionLabel } from '../core/introspect';
import type { RecordSort, Row } from '../core/records';
import type { RecordData } from '../core/records/fields';
import { connectionFromProfile, getConnection } from '../db/connections';
import { knownHostKey } from '../db/knownHosts';
import { changeRecords, readAllRecords, readRecords, writeRecords } from '../db/records';
import { useSchemaStore } from '../store/schema';
import { useSessionStore } from '../store/session';

/** The page a live table is read with. Ignored when the schema has no connection profile. */
export interface RecordsQuery {
  columns: readonly string[];
  limit: number;
  offset: number;
  orderBy?: RecordSort | null;
}

export interface RecordsState {
  /** The rows of the table asked for; one page when the schema is live, and null while they are being read. */
  rows: Row[] | null;
  /** How many rows each table has. A live schema counts only the tables that have been opened. */
  counts: Record<string, number>;
  /** The rows could not be read from browser storage. */
  failed: boolean;
  /** The schema was imported from MySQL and its rows are read from there. */
  live: boolean;
  /** Local rows can be changed. False while it is not yet known, and while live. */
  writable: boolean;
  /** The database, as the status bar names it, when the schema is live. */
  label: string | null;
  /** A live schema whose session password was cleared, by a reload. */
  needsPassword: boolean;
  /** The bridge or the database refused a live read. */
  error: BridgeError | null;
  /** Reads them again. */
  reload: () => void;
  /**
   * Changes the rows of the table: `change` is given the rows as stored and returns the rows to
   * store (see `core/records/rows`). Resolves with what was stored; rejects, with nothing written,
   * when `change` throws or the database does not take them. A live schema rejects: its rows are read-only.
   */
  change: (change: (rows: Row[]) => Row[]) => Promise<Row[]>;
  /** Replaces the rows of several tables, this one or others, in one write. Resolves with the rows each had before, to write back for an undo. */
  write: (rows: Readonly<Record<string, Row[]>>) => Promise<Record<string, Row[]>>;
  /** The rows of every table, for the editor; the table on screen gives the rows that are on screen. */
  readData: () => Promise<RecordData>;
}

interface Loaded {
  schemaId: number | null;
  table: string;
  rows: Row[];
  /** Null for rows kept in the browser. A live page names the limit, offset and order it was read with. */
  liveToken: string | null;
}

interface Counted {
  schemaId: number | null;
  counts: Record<string, number>;
}

const READ_ONLY = 'Live data is read-only.';

/**
 * The rows of `table` of the schema stored as `schemaId` (null while it is not stored), for the Data
 * mode. A schema with a connection profile is read from MySQL, one page at a time, when the session
 * still has its password. Without a profile, the rows are read from the browser when the table is
 * opened and again on `reload`.
 *
 * A schema that is not stored has no database to keep changes in: its rows can be read, drawn
 * again each time, but `change` and `write` refuse. (Every schema the app routes to is stored.)
 */
export function useRecords(schemaId: number | null, table: string, query: RecordsQuery): RecordsState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [counted, setCounted] = useState<Counted>({ schemaId, counts: {} });
  const [failed, setFailed] = useState<string | null>(null);
  const [reads, setReads] = useState(0);
  const [live, setLive] = useState(false);
  const [known, setKnown] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<BridgeError | null>(null);
  const shown = useRef<Row[] | null>(null);

  const password = useSessionStore((s) => (schemaId === null ? undefined : s.secrets[schemaId]?.password));
  const sshPassword = useSessionStore((s) => (schemaId === null ? undefined : s.secrets[schemaId]?.sshPassword));
  const sshPassphrase = useSessionStore((s) => (schemaId === null ? undefined : s.secrets[schemaId]?.sshPassphrase));

  const columnKey = query.columns.join('\0');
  const orderKey = query.orderBy ? `${query.orderBy.column}:${query.orderBy.dir}` : '';
  const token = `${query.limit}:${query.offset}:${orderKey}:${columnKey}`;

  useEffect(() => {
    let current = true;

    const finishLocal = (read: { rows: Row[]; counts: Record<string, number> }) => {
      if (!current) return;
      setLive(false);
      setKnown(true);
      setLabel(null);
      setNeedsPassword(false);
      setError(null);
      setFailed(null);
      setLoaded({ schemaId, table, rows: read.rows, liveToken: null });
      setCounted({ schemaId, counts: read.counts });
    };

    const run = async () => {
      try {
        await read();
      } catch (thrown) {
        if (!current) return;
        console.error(thrown);
        setKnown(true);
        setLive(false);
        setFailed(table);
      }
    };

    const read = async () => {
      if (schemaId !== null) {
        const profile = await getConnection(schemaId);
        if (!current) return;
        if (profile) {
          const text = connectionLabel({ ...profile, password: '' });
          setLive(true);
          setKnown(true);
          setLabel(text);
          const secrets = useSessionStore.getState().secrets[schemaId];
          if (!secrets) {
            setNeedsPassword(true);
            setError(null);
            setFailed(null);
            setLoaded(null);
            return;
          }
          setNeedsPassword(false);
          if (query.columns.length === 0) {
            setLoaded({ schemaId, table, rows: [], liveToken: token });
            setCounted((cur) => ({ schemaId, counts: { ...(cur.schemaId === schemaId ? cur.counts : {}), [table]: 0 } }));
            return;
          }
          const hostKey = profile.ssh ? await knownHostKey(profile.ssh.host, profile.ssh.port) : undefined;
          if (!current) return;
          const answer = await readRows({
            connection: connectionFromProfile(profile, secrets, hostKey),
            table,
            columns: [...query.columns],
            limit: query.limit,
            offset: query.offset,
            ...(query.orderBy ? { orderBy: query.orderBy } : {}),
          });
          if (!current) return;
          if (!answer.ok) {
            setError(answer.error);
            setFailed(null);
            setLoaded(null);
            return;
          }
          setError(null);
          setFailed(null);
          setLoaded({ schemaId, table, rows: answer.rows, liveToken: token });
          setCounted((cur) => ({ schemaId, counts: { ...(cur.schemaId === schemaId ? cur.counts : {}), [table]: answer.total } }));
          return;
        }
      }
      finishLocal(await readRecords(schemaId, useSchemaStore.getState().tables, table));
    };
    void run();
    return () => {
      current = false;
    };
    // `token` already names the columns, the page and the order. `query.columns` is a new array
    // whenever the screen renders, so it is not a dependency of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaId, table, reads, password, sshPassword, sshPassphrase, token]);

  const rows = loaded && loaded.schemaId === schemaId && loaded.table === table && (loaded.liveToken === null || loaded.liveToken === token) ? loaded.rows : null;
  useLayoutEffect(() => {
    shown.current = rows;
  });

  const counts = counted.schemaId === schemaId ? counted.counts : {};
  const canWrite = known && !live && schemaId !== null;

  // What was stored is what the screen shows from then on, and the list's counts follow.
  const show = (written: Record<string, Row[]>) => {
    setLoaded((cur) => (cur && written[cur.table] ? { ...cur, rows: written[cur.table] } : cur));
    setCounted((cur) => ({
      schemaId,
      counts: { ...(cur.schemaId === schemaId ? cur.counts : {}), ...Object.fromEntries(Object.entries(written).map(([name, list]) => [name, list.length])) },
    }));
  };

  return {
    rows,
    counts,
    failed: failed === table,
    live,
    writable: canWrite,
    label,
    needsPassword,
    error,
    reload: () => {
      setLoaded(null);
      setReads((n) => n + 1);
    },
    change: async (change) => {
      if (schemaId === null) throw new Error('The schema is not stored: its records cannot be changed.');
      if (!canWrite) throw new Error(READ_ONLY);
      const next = await changeRecords(schemaId, table, change);
      show({ [table]: next });
      return next;
    },
    write: async (written) => {
      if (schemaId === null) throw new Error('The schema is not stored: its records cannot be changed.');
      if (!canWrite) throw new Error(READ_ONLY);
      const before = await writeRecords(schemaId, written);
      show({ ...written });
      return before;
    },
    readData: async () => {
      if (!canWrite && schemaId !== null) throw new Error(READ_ONLY);
      const tables = useSchemaStore.getState().tables;
      const all = await readAllRecords(schemaId, tables);
      return shown.current ? { ...all, [table]: shown.current } : all;
    },
  };
}
