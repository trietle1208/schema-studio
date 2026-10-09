import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { Sidebar } from './components/Sidebar';
import { routeSchema, SCHEMAS_ROUTE, type Route } from './core/routes';
import { schemaSummary } from './db/schemas';
import { useSchemas } from './db/useSchemas';
import { go } from './screens/navigation';
import { Overlays } from './screens/Overlays';
import { PanelHandle } from './screens/PanelHandle';
import { requestNewSchema } from './screens/schemaActions';
import { SchemaDiff } from './screens/SchemaDiff';
import { SchemaList } from './screens/SchemaList';
import { requestSettings } from './screens/settingsActions';
import { useAppShortcuts } from './screens/useAppShortcuts';
import { VersionHistory } from './screens/VersionHistory';
import { Workspace } from './screens/Workspace';
import { useUiStore } from './store/ui';

const MINUTE = 60_000;
const APP_NAME = 'Schema Studio';

/** The current time, refreshed every minute so that relative times do not go stale. */
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** What the tab and the browser's history call a route. */
function routeTitle(route: Route): string {
  if (route.screen === 'schemas') return `Schemas · ${APP_NAME}`;
  if (route.screen === 'workspace') return `${route.schema} · ${APP_NAME}`;
  return `${route.schema} · ${route.screen === 'history' ? 'Version history' : 'Compare'} · ${APP_NAME}`;
}

export function App() {
  const route = useUiStore((s) => s.route);
  const stored = useSchemas();
  const now = useNow();
  const summaries = useMemo(() => (stored ?? []).map((s) => schemaSummary(s, now)), [stored, now]);
  useAppShortcuts();

  const title = routeTitle(route);
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <AppShell
      sidebar={
        <>
          <Sidebar
            schemas={summaries}
            // On the list no schema is the current one, as in the design.
            activeSchema={routeSchema(route) ?? undefined}
            onNavigate={(id) => {
              if (id === 'schemas') go(SCHEMAS_ROUTE);
            }}
            onSelectSchema={(schema) => go({ screen: 'workspace', schema })}
            onNew={requestNewSchema}
            onSettings={requestSettings}
          />
          <PanelHandle panel="sidebar" />
        </>
      }
      overlay={<Overlays />}
    >
      {route.screen === 'schemas' && <SchemaList schemas={stored} now={now} />}
      {route.screen === 'workspace' && <Workspace />}
      {route.screen === 'history' && <VersionHistory now={now} />}
      {route.screen === 'diff' && <SchemaDiff from={route.from} to={route.to} now={now} />}
    </AppShell>
  );
}
