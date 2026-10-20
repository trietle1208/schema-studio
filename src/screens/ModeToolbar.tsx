import type { RefObject } from 'react';
import { Toolbar } from '../components/Toolbar';
import { SCHEMAS_ROUTE, type WorkspaceMode } from '../core/routes';
import { versionLabel } from '../core/versions';
import { redo, selectDirty, undo, useCanRedo, useCanUndo, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { requestExport } from './exportActions';
import { go } from './navigation';
import { openMode, saveSchema, searchFor } from './workspaceActions';

export interface ModeToolbarProps {
  /** The mode on show: Data or Query. The diagram's own toolbar is the workspace's. */
  mode: WorkspaceMode;
  searchRef: RefObject<HTMLInputElement>;
  /** Enter in the search box. */
  onSearchSubmit?: () => void;
}

/** The toolbar of the Data and Query modes: same centered chrome as Data, without zoom/arrange. */
export function ModeToolbar({ mode, searchRef, onSearchSubmit }: ModeToolbarProps) {
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const version = useSchemaStore((s) => s.version);
  const stored = useSchemaStore((s) => s.id !== null);
  const saving = useSchemaStore((s) => s.saving);
  const dirty = useSchemaStore(selectDirty);
  const noTables = useSchemaStore((s) => s.tables.length === 0);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const search = useUiStore((s) => s.search);

  return (
    <Toolbar
      schema={name}
      engine={engine}
      version={version === null ? undefined : versionLabel(version)}
      mode={mode}
      onMode={openMode}
      dataDisabled={noTables}
      // A schema that is not stored yet is unsaved even with no edits.
      saveState={saving ? 'saving' : dirty || !stored ? 'dirty' : 'saved'}
      onSave={saveSchema}
      onUndo={undo}
      onRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      search={search}
      onSearch={searchFor}
      onSearchSubmit={onSearchSubmit}
      searchRef={searchRef}
      onSchemas={() => go(SCHEMAS_ROUTE)}
      onHistory={() => go({ screen: 'history', schema: name })}
      onExport={requestExport}
      chrome="centered"
    />
  );
}
