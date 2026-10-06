import { useMemo } from 'react';
import { AppShell } from './components/AppShell';
import { Sidebar } from './components/Sidebar';
import type { SchemaSummary } from './core/model';
import { Workspace } from './screens/Workspace';
import { useSchemaStore } from './store/schema';

export function App() {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const tableCount = useSchemaStore((s) => s.tables.length);
  // Until schemas are persisted (roadmap 3.1) the only schema is the one open in the workspace.
  const schemas = useMemo<SchemaSummary[]>(
    () => [{ name, engine, tables: tableCount, version: '', updated: '' }],
    [name, engine, tableCount],
  );

  return (
    <AppShell sidebar={<Sidebar schemas={schemas} activeSchema={name} />}>
      <Workspace />
    </AppShell>
  );
}
