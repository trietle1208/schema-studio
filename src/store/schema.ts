import { temporal, type TemporalState } from 'zundo';
import { create, useStore, type StoreApi } from 'zustand';
import { dirtyTables, isDirty } from '../core/dirty';
import { copyName, deleteTable, duplicateTable, moveTable, renameTable, updateTable } from '../core/edit';
import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import type { Position, SchemaSnapshot, Table } from '../core/model';

const HISTORY_LIMIT = 50;

export interface SchemaSource extends SchemaSnapshot {
  name: string;
  engine: string;
}

export interface SchemaState extends SchemaSource {
  /** The snapshot as of the last save or load; the working copy is dirty when it differs. */
  saved: SchemaSnapshot;
  selected: string | null;
  selectedColumn: number | null;

  load: (schema: SchemaSource) => void;
  select: (name: string | null) => void;
  selectColumn: (index: number | null) => void;
  updateTable: (name: string, table: Table) => void;
  renameTable: (from: string, to: string) => void;
  duplicateTable: (name: string) => void;
  deleteTable: (name: string) => void;
  /** Call on every pointer move of a drag; the whole drag becomes one undo step once `endMove` runs. */
  moveTable: (name: string, position: Position) => void;
  endMove: () => void;
  markSaved: () => void;
}

/** What undo and redo restore: the snapshot plus the selection that went with it. */
type Tracked = Pick<SchemaState, 'tables' | 'positions' | 'selected' | 'selectedColumn'>;

export const ecommerceSample: SchemaSource = {
  name: 'ecommerce',
  engine: 'PostgreSQL',
  tables: ecommerceTables,
  positions: ecommercePositions,
};

export function createSchemaStore(initial: SchemaSource = ecommerceSample) {
  return create<SchemaState>()(
    temporal(
      (set, get, api) => {
        const history = () => (api.temporal as StoreApi<TemporalState<Tracked>>).getState();
        let dragging = false;

        return {
          name: initial.name,
          engine: initial.engine,
          tables: initial.tables,
          positions: initial.positions,
          saved: { tables: initial.tables, positions: initial.positions },
          selected: null,
          selectedColumn: null,

          load: (schema) => {
            set({
              name: schema.name,
              engine: schema.engine,
              tables: schema.tables,
              positions: schema.positions,
              saved: { tables: schema.tables, positions: schema.positions },
              selected: null,
              selectedColumn: null,
            });
            history().clear();
          },

          select: (name) => {
            if (name === get().selected) return;
            set({ selected: name, selectedColumn: null });
          },

          selectColumn: (index) => set({ selectedColumn: index }),

          updateTable: (name, table) => set(updateTable(get(), name, table)),

          renameTable: (from, to) => {
            const state = get();
            const next = renameTable(state, from, to);
            if (next === state) return;
            set({ ...next, selected: state.selected === from ? to : state.selected });
          },

          duplicateTable: (name) => {
            const state = get();
            const copy = copyName(state.tables, name);
            const next = duplicateTable(state, name, copy);
            if (next === state) return;
            set({ ...next, selected: copy, selectedColumn: null });
          },

          deleteTable: (name) => {
            const state = get();
            const next = deleteTable(state, name);
            if (next === state) return;
            set(state.selected === name ? { ...next, selected: null, selectedColumn: null } : next);
          },

          moveTable: (name, position) => {
            const state = get();
            const next = moveTable(state, name, position);
            if (next === state) return;
            set({ positions: next.positions });
            if (!dragging) {
              dragging = true;
              history().pause();
            }
          },

          endMove: () => {
            if (!dragging) return;
            dragging = false;
            history().resume();
          },

          markSaved: () => {
            const { tables, positions } = get();
            set({ saved: { tables, positions } });
          },
        };
      },
      {
        limit: HISTORY_LIMIT,
        partialize: ({ tables, positions, selected, selectedColumn }): Tracked => ({
          tables,
          positions,
          selected,
          selectedColumn,
        }),
        // Selection alone is not an edit: only a changed snapshot adds an undo step.
        equality: (past, current) => past.tables === current.tables && past.positions === current.positions,
      },
    ),
  );
}

export type SchemaStore = ReturnType<typeof createSchemaStore>;

export const useSchemaStore = createSchemaStore();

export const selectTable = (s: SchemaState): Table | null => s.tables.find((t) => t.name === s.selected) ?? null;
export const selectDirty = (s: SchemaState): boolean => isDirty(s, s.saved);
/** Returns a new array on every call; wrap it in `useShallow` when used as a hook selector. */
export const selectDirtyTables = (s: SchemaState): string[] => dirtyTables(s, s.saved);

export const undo = () => useSchemaStore.temporal.getState().undo();
export const redo = () => useSchemaStore.temporal.getState().redo();
export const useCanUndo = () => useStore(useSchemaStore.temporal, (s) => s.pastStates.length > 0);
export const useCanRedo = () => useStore(useSchemaStore.temporal, (s) => s.futureStates.length > 0);
