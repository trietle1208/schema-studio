import { useEffect, type RefObject } from 'react';
import { stepZoom, ZOOM_STEP } from '../core/layout';
import { matchShortcut, type Shortcut } from '../core/shortcuts';
import { redo, undo, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { go } from './navigation';
import { arrangeTables, copyCreateTable, requestDeleteTable, saveSchema, showAllTables } from './workspaceActions';

// ⌫ only deletes when no control has focus, so it can never fire while a field or button is in use.
const CONTROL = 'input, textarea, select, button, [role="button"], [contenteditable]';
// Fields that edit their own text rather than the schema (search, table rename, type picker):
// undo, redo and Esc belong to the field while it has focus.
const LOCAL_EDIT = '[data-local-edit]';
// Where a key types its character or picks an option: ⇧1 and ⇧A are text there, not shortcuts.
const TYPING = 'input:not([type="checkbox"], [type="radio"]), textarea, select, [contenteditable]';
// The browser has a use of its own for these (save the page, its history, a bookmark, the zoom of
// the page): in the workspace they are the workspace's, also when one of them has nothing to do.
const TAKEN: Shortcut[] = ['save', 'search', 'duplicate', 'history', 'zoom-in', 'zoom-out', 'zoom-reset'];

/**
 * Leaves a field that edits its own text, which keeps what was typed in it, as the click on the
 * button the shortcut stands for would have.
 */
function leave(target: Element | null) {
  if (target instanceof HTMLElement && target.closest(LOCAL_EDIT)) target.blur();
}

/**
 * The workspace keyboard shortcuts: ⌘S, ⌘Z, ⇧⌘Z, ⌘K, ⌘⏎, ⌘D, ⇧⌘C, ⌘H, ⌘+, ⌘−, ⌘0, ⇧1, ⇧A, F2, ⌫
 * and Esc (Ctrl in place of ⌘ outside macOS).
 */
export function useWorkspaceShortcuts(searchRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = matchShortcut(e);
      if (!shortcut) return;
      // The browser's own ⌘S, ⌘K, ⌘D, ⌘H and zoom stay off, under a dialog all the same.
      if (TAKEN.includes(shortcut)) e.preventDefault();
      const ui = useUiStore.getState();
      // An open dialog owns the keyboard, Esc included. This listener is added before any dialog's,
      // so it still sees the dialog as open on the key press that closes it.
      if (ui.dialog) return;
      const target = e.target instanceof Element ? e.target : null;
      const local = !!target?.closest(LOCAL_EDIT);
      const schema = useSchemaStore.getState();

      switch (shortcut) {
        case 'save':
          void saveSchema();
          break;
        case 'undo':
        case 'redo':
          if (local) return;
          e.preventDefault();
          if (shortcut === 'undo') undo();
          else redo();
          break;
        case 'search':
          searchRef.current?.focus();
          searchRef.current?.select();
          break;
        case 'add-column':
          // Inside the inspector the key is the inspector's, which adds the column itself; in the
          // search box it would add one to the table Enter has only just selected.
          if (!schema.selected || local || e.defaultPrevented) return;
          e.preventDefault();
          schema.addColumn(schema.selected);
          break;
        case 'copy-create-table':
          if (!schema.selected) return;
          e.preventDefault();
          void copyCreateTable(schema.selected);
          break;
        case 'duplicate': {
          leave(target);
          // Leaving the name of the table may just have renamed it.
          const { selected, duplicateTable } = useSchemaStore.getState();
          if (selected) duplicateTable(selected);
          break;
        }
        case 'history':
          leave(target);
          go({ screen: 'history', schema: schema.name });
          break;
        case 'zoom-in':
          ui.setZoom(stepZoom(ui.zoom, ZOOM_STEP));
          break;
        case 'zoom-out':
          ui.setZoom(stepZoom(ui.zoom, -ZOOM_STEP));
          break;
        case 'zoom-reset':
          ui.setZoom(1);
          break;
        case 'fit':
          if (target?.closest(TYPING)) return;
          e.preventDefault();
          ui.setFitPending(true);
          break;
        case 'arrange':
          if (target?.closest(TYPING)) return;
          e.preventDefault();
          arrangeTables();
          break;
        case 'rename':
          if (!schema.selected) return;
          e.preventDefault();
          useUiStore.getState().requestRename();
          break;
        case 'delete':
          if (!schema.selected || target?.closest(CONTROL)) return;
          e.preventDefault();
          requestDeleteTable(schema.selected);
          break;
        case 'cancel':
          if (local) return;
          // Esc first closes the column that is open, then ends the focus.
          if (schema.selectedColumn !== null) schema.selectColumn(null);
          else showAllTables();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchRef]);
}
