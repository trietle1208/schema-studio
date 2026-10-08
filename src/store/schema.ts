import { temporal, type TemporalState } from 'zundo';
import { create, useStore, type StoreApi } from 'zustand';
import { arrangeOnly, arrangeTables } from '../core/arrange';
import { addColumn, clearDrafts } from '../core/columns';
import { dirtyTables, isDirty } from '../core/dirty';
import {
  addTable,
  copyName,
  deleteTable,
  duplicateTable,
  moveTables,
  newTable,
  newTableName,
  renameTable,
  updateTable,
} from '../core/edit';
import { ecommercePositions, ecommerceTables } from '../core/fixtures/ecommerce';
import { groupsOf } from '../core/groups';
import { addInferred } from '../core/infer';
import type { OnDelete, Position, Positions, SchemaSnapshot, Table, TableGroup } from '../core/model';
import { positionOf } from '../core/positions';
import { addForeignKey, countInferred, declareInferred, removeInferred, type ColumnRef } from '../core/relations';
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
  /** The groups of tables, which a snapshot may leave out and the open schema never does. */
  groups: readonly TableGroup[];
  /** The number of the version in `saved`; null until the first save. */
  version: number | null;
  /** The snapshot as of the last save or load; the working copy is dirty when it differs. */
  saved: SchemaSnapshot;
  /** True while a save is being written. */
  saving: boolean;
  /** The selected table, which the inspector edits; null when none is selected, and when several are. */
  selected: string | null;
  /** Every selected table: the one in `selected`, or the several that are moved and arranged together. */
  selection: string[];
  selectedColumn: number | null;
  /** The table the canvas is focused on: only it and the tables related to it are shown. Null when all are. */
  focused: string | null;

  load: (schema: SchemaSource) => void;
  /** Selects one table, or none with null. */
  select: (name: string | null) => void;
  /** Selects the tables called `names` and no other, as Shift + click and a frame on the canvas do. */
  selectTables: (names: readonly string[]) => void;
  selectColumn: (index: number | null) => void;
  /** Focuses the canvas on a table and the tables related to it; null shows every table again. */
  focus: (name: string | null) => void;
  /**
   * Replaces a table. Consecutive calls with the same `coalesce` key are one undo step, so typing
   * into a field is undone at once; changing the selection or making any other edit ends the run.
   */
  updateTable: (name: string, table: Table, coalesce?: string) => void;
  renameTable: (from: string, to: string) => void;
  /** Adds a new table at `position` and selects it. Returns the name it was given. */
  addTable: (position: Position) => string;
  duplicateTable: (name: string) => void;
  deleteTable: (name: string) => void;
  /** Adds a blank column to a table and selects it, so that the inspector asks for its name. */
  addColumn: (name: string) => void;
  /**
   * Adds a foreign key from the column `from` to the column `to` and selects `from`, which is added
   * to its table when the table has no column of that name. Returns whether it did.
   */
  addForeignKey: (from: ColumnRef, to: ColumnRef, onDelete?: OnDelete) => boolean;
  /** Adds the foreign keys the names of the columns point to, marked as inferred. Returns how many it added. */
  inferRelations: () => number;
  /** Makes every inferred foreign key a declared one, or the one on the column `only`. Returns how many it changed. */
  acceptInferred: (only?: ColumnRef) => number;
  /** Removes every inferred foreign key, or the one on the column `only`. Returns how many it removed. */
  removeInferred: (only?: ColumnRef) => number;
  /**
   * Changes the groups of tables by an edit of core/groups (`assignGroup`, `renameGroup`…), in one
   * undo step. Returns whether it changed them.
   */
  editGroups: (edit: (groups: readonly TableGroup[]) => readonly TableGroup[]) => boolean;
  /**
   * Moves every table to where its relationships put it (see core/arrange), in one undo step, or
   * the tables called `only` among themselves, where they are. Returns whether any table moved.
   */
  arrangeTables: (only?: readonly string[]) => boolean;
  /** Call on every pointer move of a drag; the whole drag becomes one undo step once `endMove` runs. */
  moveTable: (name: string, position: Position) => void;
  /** The same for a drag of several tables: where each of them is now. */
  moveTables: (positions: Positions) => void;
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
type Tracked = Pick<SchemaState, 'tables' | 'positions' | 'groups' | 'selected' | 'selection' | 'selectedColumn'>;

export const ecommerceSample: SchemaSource = {
  name: 'ecommerce',
  engine: 'PostgreSQL',
  tables: ecommerceTables,
  positions: ecommercePositions,
};

/** The two fields that say which tables are selected. */
function chosen(names: readonly string[]): Pick<SchemaState, 'selected' | 'selection'> {
  return { selected: names.length === 1 ? names[0] : null, selection: [...names] };
}

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
          groups: groupsOf(initial),
          saved: { tables: initial.tables, positions: initial.positions, groups: groupsOf(initial) },
          saving: false,
          ...chosen([]),
          selectedColumn: null,
          focused: null,

          load: (schema) => {
            loads++;
            set({
              name: schema.name,
              engine: schema.engine,
              id: schema.id ?? null,
              version: schema.version ?? null,
              tables: schema.tables,
              positions: schema.positions,
              groups: groupsOf(schema),
              saved: { tables: schema.tables, positions: schema.positions, groups: groupsOf(schema) },
              saving: false,
              ...chosen([]),
              selectedColumn: null,
              focused: null,
            });
            history().clear();
          },

          select: (name) => get().selectTables(name === null ? [] : [name]),

          selectTables: (names) => {
            typing = null;
            const state = get();
            const next = chosen([...new Set(names)]);
            if (next.selection.length === state.selection.length && next.selection.every((n, i) => n === state.selection[i])) return;
            set({ ...next, selectedColumn: null });
          },

          selectColumn: (index) => {
            typing = null;
            set({ selectedColumn: index });
          },

          focus: (name) => set({ focused: name }),

          updateTable: (name, table, coalesce) => {
            const state = get();
            const next = updateTable(state, name, table);
            if (next === state) return;
            const key = coalesce === undefined ? null : `${name}:${coalesce}`;
            const continues =
              typing !== null &&
              typing.key === key &&
              typing.snapshot.tables === state.tables &&
              typing.snapshot.positions === state.positions &&
              typing.snapshot.groups === state.groups;
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
            set({
              ...next,
              ...chosen(state.selection.map((n) => (n === from ? to : n))),
              focused: state.focused === from ? to : state.focused,
            });
          },

          addTable: (position) => {
            const state = get();
            const name = newTableName(state.tables);
            set({ ...addTable(state, newTable(name), position), ...chosen([name]), selectedColumn: null });
            return name;
          },

          duplicateTable: (name) => {
            const state = get();
            const copy = copyName(state.tables, name);
            const next = duplicateTable(state, name, copy);
            if (next === state) return;
            set({ ...next, ...chosen([copy]), selectedColumn: null });
          },

          deleteTable: (name) => {
            const state = get();
            const next = deleteTable(state, name);
            if (next === state) return;
            const rest = state.selection.filter((n) => n !== name);
            set(rest.length === state.selection.length ? next : { ...next, ...chosen(rest), selectedColumn: null });
          },

          addColumn: (name) => {
            const { tables } = get();
            const table = tables.find((t) => t.name === name);
            if (!table) return;
            typing = null;
            set({
              tables: tables.map((t) => (t === table ? addColumn(table) : t)),
              ...chosen([name]),
              selectedColumn: table.columns.length,
            });
          },

          addForeignKey: (from, to, onDelete) => {
            const { tables } = get();
            const next = addForeignKey(tables, from, to, onDelete);
            if (next === tables) return false;
            typing = null;
            const columns = next.find((t) => t.name === from.table)?.columns ?? [];
            set({ tables: next, ...chosen([from.table]), selectedColumn: columns.findIndex((c) => c.name === from.column) });
            return true;
          },

          inferRelations: () => {
            const { tables } = get();
            const next = addInferred(tables);
            if (next === tables) return 0;
            set({ tables: next });
            return countInferred(next) - countInferred(tables);
          },

          acceptInferred: (only) => {
            const { tables } = get();
            const next = declareInferred(tables, only);
            const count = countInferred(tables) - countInferred(next);
            if (count) set({ tables: next });
            return count;
          },

          removeInferred: (only) => {
            const { tables } = get();
            const next = removeInferred(tables, only);
            const count = countInferred(tables) - countInferred(next);
            if (count) set({ tables: next });
            return count;
          },

          editGroups: (edit) => {
            const { groups } = get();
            const next = edit(groups);
            if (next === groups) return false;
            typing = null;
            set({ groups: next });
            return true;
          },

          arrangeTables: (only) => {
            const { tables, positions } = get();
            const next = only ? arrangeOnly(tables, positions, only) : arrangeTables(tables);
            const moved = tables.some((t) => {
              const from = positionOf(positions, t.name);
              const to = positionOf(next, t.name);
              return !from || !to || from.x !== to.x || from.y !== to.y;
            });
            if (moved) set({ positions: next });
            return moved;
          },

          moveTable: (name, position) => get().moveTables({ [name]: position }),

          moveTables: (positions) => {
            const state = get();
            const next = moveTables(state, positions);
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
              set({ ...chosen([problem.table]), selectedColumn: problem.column });
              return { status: 'invalid' };
            }
            // A schema that is not stored yet is saved even when nothing in it has changed.
            if (state.id !== null && !isDirty(state, state.saved)) return { status: 'unchanged' };

            const snapshot: SchemaSnapshot = { tables: clearDrafts(state.tables), positions: state.positions, groups: state.groups };
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
        partialize: ({ tables, positions, groups, selected, selection, selectedColumn }): Tracked => ({
          tables,
          positions,
          groups,
          selected,
          selection,
          selectedColumn,
        }),
        // Selection alone is not an edit: only a changed snapshot adds an undo step.
        equality: (past, current) =>
          past.tables === current.tables && past.positions === current.positions && past.groups === current.groups,
      },
    ),
  );
}

export type SchemaStore = ReturnType<typeof createSchemaStore>;

export const useSchemaStore = createSchemaStore();

export const selectTable = (s: SchemaState): Table | null => s.tables.find((t) => t.name === s.selected) ?? null;
/** The table the canvas is focused on, or null when it shows every table; a focus on a table that is gone is none. */
export const selectFocused = (s: SchemaState): string | null =>
  s.focused !== null && s.tables.some((t) => t.name === s.focused) ? s.focused : null;
export const selectDirty = (s: SchemaState): boolean => isDirty(s, s.saved);
/** Returns a new array on every call; wrap it in `useShallow` when used as a hook selector. */
export const selectDirtyTables = (s: SchemaState): string[] => dirtyTables(s, s.saved);

export const undo = () => useSchemaStore.temporal.getState().undo();
export const redo = () => useSchemaStore.temporal.getState().redo();
export const useCanUndo = () => useStore(useSchemaStore.temporal, (s) => s.pastStates.length > 0);
export const useCanRedo = () => useStore(useSchemaStore.temporal, (s) => s.futureStates.length > 0);
