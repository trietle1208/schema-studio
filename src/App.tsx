import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { Sidebar } from './components/Sidebar';
import type { SchemaRecord } from './db/db';
import { listSchemas, schemaSummary } from './db/schemas';
import { Workspace } from './screens/Workspace';
import { useSchemaStore } from './store/schema';

const MINUTE = 60_000;
const NO_SCHEMAS: SchemaRecord[] = [];

/** The current time, refreshed every minute so that relative times do not go stale. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function App() {
  const name = useSchemaStore((s) => s.name);
  // Re-read whenever a schema or version is written, in this tab or another. With no database there is no list.
  const stored = useLiveQuery(() => listSchemas().catch(() => NO_SCHEMAS), [], NO_SCHEMAS);
  const now = useNow();
  const schemas = useMemo(() => stored.map((s) => schemaSummary(s, now)), [stored, now]);

  return (
    <AppShell sidebar={<Sidebar schemas={schemas} activeSchema={name} />}>
      <Workspace />
    </AppShell>
  );
}
