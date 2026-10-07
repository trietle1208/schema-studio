import { useEffect, type RefObject } from 'react';
import { matchShortcut } from '../core/shortcuts';
import { redo, undo, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

// ⌫ only deletes when no control has focus, so it can never fire while a field or button is in use.
const CONTROL = 'input, textarea, select, button, [role="button"], [contenteditable]';
// Fields that edit their own text rather than the schema (search, table rename, type picker):
// undo, redo and Esc belong to the field while it has focus.
const LOCAL_EDIT = '[data-local-edit]';

/** The workspace keyboard shortcuts: ⌘S, ⌘Z, ⇧⌘Z, ⌘K, F2, ⌫ and Esc (Ctrl in place of ⌘ outside macOS). */
export function useWorkspaceShortcuts(searchRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = matchShortcut(e);
      if (!shortcut) return;
      const target = e.target instanceof Element ? e.target : null;
      const local = !!target?.closest(LOCAL_EDIT);
      const schema = useSchemaStore.getState();

      switch (shortcut) {
        case 'save':
          e.preventDefault();
          schema.save();
          break;
        case 'undo':
        case 'redo':
          if (local) return;
          e.preventDefault();
          if (shortcut === 'undo') undo();
          else redo();
          break;
        case 'search':
          e.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
          break;
        case 'rename':
          if (!schema.selected) return;
          e.preventDefault();
          useUiStore.getState().requestRename();
          break;
        case 'delete':
          if (!schema.selected || target?.closest(CONTROL)) return;
          e.preventDefault();
          schema.deleteTable(schema.selected);
          break;
        case 'cancel':
          if (local || schema.selectedColumn === null) return;
          schema.selectColumn(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchRef]);
}
