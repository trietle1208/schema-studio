import { temporal, type TemporalState } from 'zundo';
import { create, useStore, type StoreApi } from 'zustand';
import { clearDrafts } from '../core/columns';
import { dirtyTables, isDirty } from '../core/dirty';
import { copyName, deleteTable, duplicateTable, moveTable, renameTable, updateTable } from '../core/edit';
import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import type { Position, SchemaSnapshot, Table } from '../core/model';
import { findProblems } from '../core/validate';
import { createSchema, saveVersion } from '../db/schemas';

const HISTORY_LIMIT = 50;

export interface SchemaSource extends SchemaSnapshot {
  name: string;
  engine: string;
  /** Where the snapshot is stored. Left out for a schema that has not been saved yet. */
  id?: number;
  version?: number;
}

/** What a schema is stored under: its id in the database and the number of the version. */
export interface StoredAs {
  id: number;
  version: number;
}

/**
 * Stores `snapshot` as a new version of a schema and resolves with where it went. A schema whose
 * `id` is null has never been stored and is created by this.
 */
export type Persist = (
  schema: { id: number | null; name: string; engine: string },
  snapshot: SchemaSnapshot,
) => Promise<StoredAs>;

/**
 * How a save went: `saved` as a new version, `unchanged` because there was nothing to save,
 * `invalid` because of validation problems, or `busy` because another save is still running.
 */
export type SaveResult = { status: 'saved'; version: number } | { status: 'unchanged' | 'invalid' | 'busy' };

export interface SchemaState extends SchemaSnapshot {
  name: string;
  engine: string;
  /** The schema's id in the database; null until its first save. */
  id: number | null;
  /** The number of the version in `saved`; null until the first save. */
  version: number | null;
  /** The snapshot as of the last save or load; the working copy is dirty when it differs. */
  saved: SchemaSnapshot;
  /** True while a save is being written. */
  saving: boolean;
  selected: string | null;
  selectedColumn: number | null;

  load: (schema: SchemaSource) => void;
  select: (name: string | null) => void;
  selectColumn: (index: number | null) => void;
  /**
   * Replaces a table. Consecutive calls with the same `coalesce` key are one undo step, so typing
   * into a field is undone at once; changing the selection or making any other edit ends the run.
   */
  updateTable: (name: string, table: Table, coalesce?: string) => void;
  renameTable: (from: string, to: string) => void;
  duplicateTable: (name: string) => void;
  deleteTable: (name: string) => void;
  /** Call on every pointer move of a drag; the whole drag becomes one undo step once `endMove` runs. */
  moveTable: (name: string, position: Position) => void;
  endMove: () => void;
  /**
   * Stores the working copy as a new version. A schema with validation problems is not saved: the
   * first problem is selected instead, so its message shows in the inspector. Columns added since
   * the last save stop being drafts. Rejects when the version could not be written; the working
   * copy is then as it was.
   */
  save: () => Promise<SaveResult>;
}

/** What undo and redo restore: the snapshot plus the selection that went with it. */
type Tracked = Pick<SchemaState, 'tables' | 'positions' | 'selected' | 'selectedColumn'>;

export const ecommerceSample: SchemaSource = {
  name: 'ecommerce',
  engine: 'PostgreSQL',
  tables: ecommerceTables,
  positions: ecommercePositions,
};

const persistToDatabase: Persist = async ({ id, name, engine }, snapshot) => {
  const stored = id === null ? await createSchema({ name, engine }, snapshot) : await saveVersion(id, snapshot);
  return { id: stored.id, version: stored.version };
};

export function createSchemaStore(initial: SchemaSource = ecommerceSample, persist: Persist = persistToDatabase) {
  return create<SchemaState>()(
    temporal(
      (set, get, api) => {
        const history = () => (api.temporal as StoreApi<TemporalState<Tracked>>).getState();
        let dragging = false;
        /** Counts calls to `load`, so a save can tell that its schema has been replaced meanwhile. */
        let loads = 0;
        /** The last coalescing edit and the snapshot it produced. */
        let typing: { key: string; snapshot: SchemaSnapshot } | null = null;

        return {
          name: initial.name,
          engine: initial.engine,
          id: initial.id ?? null,
          version: initial.version ?? null,
          tables: initial.tables,
          positions: initial.positions,
          saved: { tables: initial.tables, positions: initial.positions },
          saving: false,
          selected: null,
          selectedColumn: null,

          load: (schema) => {
            loads++;
            set({
              name: schema.name,
              engine: schema.engine,
              id: schema.id ?? null,
              version: schema.version ?? null,
              tables: schema.tables,
              positions: schema.positions,
              saved: { tables: schema.tables, positions: schema.positions },
              saving: false,
              selected: null,
              selectedColumn: null,
            });
            history().clear();
          },

          select: (name) => {
            typing = null;
            if (name === get().selected) return;
            set({ selected: name, selectedColumn: null });
          },

          selectColumn: (index) => {
            typing = null;
            set({ selectedColumn: index });
          },

          updateTable: (name, table, coalesce) => {
            const state = get();
            const next = updateTable(state, name, table);
            if (next === state) return;
            const key = coalesce === undefined ? null : `${name}:${coalesce}`;
            const continues =
              typing !== null &&
              typing.key === key &&
              typing.snapshot.tables === state.tables &&
              typing.snapshot.positions === state.positions;
            if (continues && !dragging) {
              history().pause();
              set(next);
              history().resume();
            } else {
              set(next);
            }
            typing = key === null ? null : { key, snapshot: next };
          },

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

          save: async () => {
            const state = get();
            if (state.saving) return { status: 'busy' };
            const problem = findProblems(state.tables)[0];
            if (problem) {
              typing = null;
              set({ selected: problem.table, selectedColumn: problem.column });
              return { status: 'invalid' };
            }
            // A schema that is not stored yet is saved even when nothing in it has changed.
            if (state.id !== null && !isDirty(state, state.saved)) return { status: 'unchanged' };

            const snapshot: SchemaSnapshot = { tables: clearDrafts(state.tables), positions: state.positions };
            const load = loads;
            set({ saving: true });
            let stored: StoredAs;
            try {
              stored = await persist({ id: state.id, name: state.name, engine: state.engine }, snapshot);
            } catch (error) {
              if (load === loads) set({ saving: false });
              throw error;
            }
            const result: SaveResult = { status: 'saved', version: stored.version };
            // The version is stored either way, but another schema may have been loaded meanwhile.
            if (load !== loads) return result;

            // Tables edited while the version was being written stay as they are, and so stay dirty.
            const current = get().tables;
            const tables =
              current === state.tables
                ? snapshot.tables
                : current.map((t) => {
                    const i = state.tables.indexOf(t);
                    return i < 0 ? t : snapshot.tables[i];
                  });
            // Dropping the draft marks is part of saving, not an edit to undo.
            if (!dragging) history().pause();
            set({ id: stored.id, version: stored.version, tables, saved: snapshot, saving: false });
            if (!dragging) history().resume();
            return result;
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
