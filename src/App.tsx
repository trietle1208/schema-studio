import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { Sidebar } from './components/Sidebar';
import { schemaSummary } from './db/schemas';
import { useSchemas } from './db/useSchemas';
import { Overlays } from './screens/Overlays';
import { SchemaList } from './screens/SchemaList';
import { openSchema, requestNewSchema, showSchemas } from './screens/schemaActions';
import { useAppShortcuts } from './screens/useAppShortcuts';
import { Workspace } from './screens/Workspace';
import { useSchemaStore } from './store/schema';
import { useUiStore } from './store/ui';

const MINUTE = 60_000;

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
  const screen = useUiStore((s) => s.screen);
  const name = useSchemaStore((s) => s.name);
  const stored = useSchemas();
  const now = useNow();
  const summaries = useMemo(() => (stored ?? []).map((s) => schemaSummary(s, now)), [stored, now]);
  useAppShortcuts();

  return (
    <AppShell
      sidebar={
        <Sidebar
          schemas={summaries}
          // On the list no schema is the current one, as in the design.
          activeSchema={screen === 'workspace' ? name : undefined}
          onNavigate={(id) => {
            if (id === 'schemas') showSchemas();
          }}
          onSelectSchema={(selected) => {
            const schema = stored?.find((s) => s.name === selected);
            if (schema) openSchema(schema.id);
          }}
          onNew={requestNewSchema}
        />
      }
      overlay={<Overlays />}
    >
      {screen === 'workspace' ? <Workspace /> : <SchemaList schemas={stored} now={now} />}
    </AppShell>
  );
}
