import { useRef } from 'react';
import { EmptyState } from '../components/EmptyState';
import { StatusBar } from '../components/StatusBar';
import { t } from '../core/i18n';
import { useSchemaStore } from '../store/schema';
import { ModeToolbar } from './ModeToolbar';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';

/** The Query mode. The console itself comes in a later step; the route and the mode switch are here. */
export function QueryMode() {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const searchRef = useRef<HTMLInputElement>(null);
  useWorkspaceShortcuts(searchRef, 'query');

  return (
    <>
      <ModeToolbar mode="query" searchRef={searchRef} />
      <div className="ss-work">
        <div className="ss-data" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState compact title={t('query.soon.title')} description={t('query.soon.description', { schema: name })} />
        </div>
      </div>
      <StatusBar left={[name]} right={[engine]} />
    </>
  );
}
