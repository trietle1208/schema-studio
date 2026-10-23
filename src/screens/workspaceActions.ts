import { flushSync } from 'react-dom';
import { countLines } from '../core/files';
import { EXPORT_ENGINES, generatorFor, tableScript } from '../core/generate';
import { convertTables } from '../core/generate/convert';
import type { ColumnsChoice } from '../core/edit';
import type { DiagramView } from '../core/diagramView';
import { visibleNames } from '../core/explorer';
import { assignGroup, newGroupName } from '../core/groups';
import { suggestModules } from '../core/modules';
import { t } from '../core/i18n';
import type { Position } from '../core/model';
import { dataTable, modeRoute, type WorkspaceMode } from '../core/routes';
import { countInferred, qualifiedName, referenceProblem, referenceTargets, type ColumnRef } from '../core/relations';
import { validateColumns } from '../core/validate';
import { versionLabel } from '../core/versions';
import { undo, useSchemaStore, type SaveResult } from '../store/schema';
import { useUiStore } from '../store/ui';
import { go } from './navigation';

/**
 * The tables the canvas of the open schema shows: what is being looked at, when something is, and
 * otherwise what the schema keeps (see `lookAt`). Undefined is the default of the schema.
 */
export function currentShown(): readonly string[] | undefined {
  const { name, shown } = useSchemaStore.getState();
  const ui = useUiStore.getState();
  return ui.lookShownFor === name && ui.lookShown ? ui.lookShown : shown;
}

/**
 * Shows `names` on the canvas for now: a module that was opened, a saved view, a path. Only the
 * ui changes, so the schema is no more edited than it is by panning. It is not undone, not saved
 * and not a change; `showTables` is what writes the tables of the schema.
 */
export function lookAt(names: readonly string[]) {
  useUiStore.getState().setLookShown(names, useSchemaStore.getState().name);
}

/**
 * The Explorer's checkbox, eye, Show and Hide, "Add to canvas" and a table asked for by name: the
 * canvas shows `names` and the schema keeps them, as an edit with its undo step and its mark.
 */
export function showTables(names: readonly string[]) {
  useUiStore.getState().setLookShown(null, null);
  useSchemaStore.getState().setShown(names);
}

/**
 * ⌘S and the Save button: stores the working copy as a new version and says in a toast how it went.
 * Never rejects.
 */
export async function saveSchema(): Promise<void> {
  const schema = useSchemaStore.getState();
  const ui = useUiStore.getState();
  let result: SaveResult;
  try {
    result = await schema.save();
  } catch (error) {
    console.error(error);
    ui.showToast({
      tone: 'error',
      title: t('toast.saveFailed.title'),
      description: t('toast.saveFailed.description'),
    });
    return;
  }
  if (result.status === 'invalid') {
    ui.showToast({
      tone: 'error',
      title: t('toast.invalid.title'),
      description: t('toast.invalid.description'),
    });
  }
  // Saving an unchanged schema saves nothing, so there is nothing to announce.
  if (result.status === 'saved') {
    ui.showToast({
      title: t('toast.saved.title', { version: versionLabel(result.version) }),
      description: `${schema.name} · ${t('count.tables', { count: schema.tables.length })}`,
    });
  }
}

/**
 * "New table" in the canvas menu and the inspector: adds a table at `position`, selects it and
 * puts its name into rename mode.
 */
export function newTable(position: Position) {
  const ui = useUiStore.getState();
  // A search would hide the new table unless its name happened to match, and a focus always would.
  ui.setSearch('');
  showAllTables();
  // The inspector has to show the new table before it can be told to rename it.
  const looking = ui.lookShown !== null && ui.lookShownFor === useSchemaStore.getState().name ? ui.lookShown : null;
  let added = '';
  flushSync(() => {
    added = useSchemaStore.getState().addTable(position);
  });
  // A table that is made while a module is open is on the canvas it was made on.
  if (looking) ui.setLookShown([...looking, added], useSchemaStore.getState().name);
  ui.requestRename();
}

/** ⌫, the inspector and the canvas menu: deleting a table is confirmed in a dialog first. */
export function requestDeleteTable(name: string) {
  if (!useSchemaStore.getState().tables.some((t) => t.name === name)) return;
  useUiStore.getState().openDialog({ kind: 'delete-table', table: name });
}

/** The confirmed delete: removes the table and offers Undo in a toast. */
export function deleteTable(name: string) {
  const ui = useUiStore.getState();
  ui.closeDialog();
  useSchemaStore.getState().deleteTable(name);
  const id = ui.showToast({
    tone: 'info',
    title: t('toast.tableDeleted.title', { name }),
    description: t('toast.tableDeleted.description'),
    actions: [{ label: t('common.undo'), onClick: undo }],
  });
  // Undo reverts the latest edit, so the offer only holds until the schema changes again
  // (which undoing the delete does too).
  const { tables, positions } = useSchemaStore.getState();
  const unsubscribe = useSchemaStore.subscribe((s) => {
    if (s.tables === tables && s.positions === positions) return;
    unsubscribe();
    ui.dismissToast(id);
  });
}

/**
 * "Add foreign key…" in the table menu and the inspector: opens the dialog that asks for the column
 * and the table it references. A table that has nothing to reference gets a toast that says so.
 */
export function requestAddForeignKey(name: string) {
  const ui = useUiStore.getState();
  const { tables } = useSchemaStore.getState();
  const table = tables.find((t) => t.name === name);
  if (!table) return;
  if (!referenceTargets(table, tables).length) {
    ui.showToast({
      tone: 'info',
      title: t('toast.noReference.title'),
      description: t('toast.noReference.description'),
    });
    return;
  }
  ui.openDialog({ kind: 'add-foreign-key', table: name });
}

/**
 * A foreign key drawn on the canvas, from a column to the column of another table it was let go
 * on: declares it in one undo step, selects its column and names it in a toast. A column that
 * referenced another column references this one in its place, with the ON DELETE action it had.
 * A foreign key that cannot be drawn (see `referenceProblem`) is not: the canvas says why while
 * the line is dragged.
 */
export function drawForeignKey(from: ColumnRef, to: ColumnRef) {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  if (referenceProblem(schema.tables, from, to)) return;
  const had = schema.tables.find((t) => t.name === from.table)?.columns.find((c) => c.name === from.column)?.fk;
  if (!schema.addForeignKey(from, to, had?.onDelete)) return;
  // An inferred foreign key was not in the database, so the one that is drawn replaces nothing.
  const replaced = had && !had.inferred ? qualifiedName(had) : null;
  const reference = `${qualifiedName(from)} → ${qualifiedName(to)}`;
  ui.showToast(
    replaced
      ? { title: t('toast.fkChanged.title'), description: t('toast.fkChanged.description', { reference, replaced }) }
      : { title: t('toast.fkAdded.title'), description: t('toast.fkAdded.description', { reference }) },
  );
}

/**
 * "Copy CREATE TABLE" in the table menu and ⇧⌘C: puts the statements that make the table on the
 * clipboard, written for the database of the schema, and says in a toast how it went. Never rejects.
 */
export async function copyCreateTable(name: string): Promise<void> {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  const table = schema.tables.find((t) => t.name === name);
  if (!table) return;
  // As in an export, DDL is written for an engine that has a generator, whatever the schema was made for.
  const database = EXPORT_ENGINES.includes(schema.engine) ? schema.engine : EXPORT_ENGINES[0];
  const generator = generatorFor(database);
  if (!generator) return;
  const text = tableScript(generator, convertTables(schema.tables, schema.engine, database), name);
  try {
    await navigator.clipboard.writeText(text);
    // A column that is not valid is copied as it is, and the statement will not run: the toast says so.
    const invalid = Object.keys(validateColumns(table)).length;
    ui.showToast({
      tone: invalid ? 'info' : 'success',
      title: t('toast.copiedCreate.title'),
      description: `${name} · ${database} · ${t('count.lines', { count: countLines(text) })}${invalid ? ` · ${t('count.invalidColumns', { count: invalid })}` : ''}`,
    });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}

/**
 * Focus on `name`: the table sits in the middle of the Focus view. A table with no relationship
 * is still the centre, with empty columns beside it. The tables already visited stay in the
 * breadcrumb. A search would hide neighbours whose names do not match, so it is cleared.
 */
export function focusRelatedTables(name: string) {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  if (!schema.tables.some((table) => table.name === name)) return;
  const same = schema.focused === name;
  ui.setSearch('');
  schema.select(name);
  schema.focus(name);
  ui.setDiagramView('focus', schema.name);
  const trail = ui.focusTrailFor === schema.name ? ui.focusTrail : [];
  if (trail[trail.length - 1] !== name) ui.setFocusTrail([...trail, name], schema.name);
  if (!same) {
    ui.setFocusExpanded([]);
    ui.setFocusRevealed([]);
  }
}

/**
 * The Modules | Tables | Focus control of the toolbar, and what "back to Modules" does. Choosing is
 * looking: nothing here edits the schema. Focus opens on `selected` when a table is.
 */
export function chooseDiagramView(next: DiagramView, selected: string | null) {
  const ui = useUiStore.getState();
  const name = useSchemaStore.getState().name;
  if (next === 'focus') {
    ui.setDiagramView('focus', name);
    if (selected) focusRelatedTables(selected);
    return;
  }
  // Show all tables also leaves Focus, so the view is set after it.
  showAllTables();
  ui.setDiagramView(next, name);
  if (next === 'tables') ui.setFitPending(true);
}

/**
 * Opens a module on the Tables view: the canvas shows its tables and fits them. It only looks at
 * them (see `lookAt`); the schema keeps what it showed and stays as clean as it was.
 */
export function openModule(names: readonly string[]) {
  const ui = useUiStore.getState();
  showAllTables();
  lookAt(names);
  ui.setDiagramView('tables', useSchemaStore.getState().name);
  ui.setFitPending(true);
}

/** The previous table of the Focus breadcrumb. */
export function focusBack() {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  if (ui.focusTrailFor !== schema.name || ui.focusTrail.length < 2) return;
  const trail = ui.focusTrail.slice(0, -1);
  openTrail(trail, schema.name);
}

/** A table already visited: the breadcrumb keeps that step and drops the ones after it. */
export function focusTrailTo(index: number) {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  if (ui.focusTrailFor !== schema.name || index < 0 || index >= ui.focusTrail.length - 1) return;
  openTrail(ui.focusTrail.slice(0, index + 1), schema.name);
}

function openTrail(trail: string[], schemaName: string) {
  const name = trail[trail.length - 1];
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  ui.setFocusTrail(trail, schemaName);
  ui.setFocusExpanded([]);
  ui.setFocusRevealed([]);
  schema.select(name);
  schema.focus(name);
  ui.setDiagramView('focus', schemaName);
}

/** "Show all tables" and Esc: ends the focus. The canvas stays where it is, with the other tables back around it. */
export function showAllTables() {
  const ui = useUiStore.getState();
  useSchemaStore.getState().focus(null);
  if (ui.diagramView === 'focus') ui.setDiagramView('tables', ui.diagramFor ?? useSchemaStore.getState().name);
  if (ui.focusTrail.length) ui.setFocusTrail([], null);
  if (ui.focusExpanded.length) ui.setFocusExpanded([]);
  if (ui.focusRevealed.length) ui.setFocusRevealed([]);
}

/** The toolbar search. It looks through every table, so typing in it ends a focus. */
export function searchFor(text: string) {
  if (text.trim()) showAllTables();
  useUiStore.getState().setSearch(text);
}

/**
 * "Infer relationships" in the canvas menu: adds the foreign keys the names of the columns point
 * to, for a schema whose database declares none, and says in a toast how many it found.
 */
export function inferRelationships(only?: string) {
  const ui = useUiStore.getState();
  const added = useSchemaStore.getState().inferRelations(only);
  if (!added) {
    ui.showToast({
      tone: 'info',
      title: t('toast.nothingToInfer.title'),
      description: t('toast.nothingToInfer.description'),
    });
    return;
  }
  ui.showToast({
    title: t('toast.inferred.title', { count: added }),
    description: t('toast.inferred.description'),
    actions: [{ label: t('toast.inferred.review'), onClick: requestReviewInferred }],
  });
}

/** "Review inferred relationships…": opens the list in which each one is accepted or removed. */
export function requestReviewInferred() {
  const ui = useUiStore.getState();
  if (!countInferred(useSchemaStore.getState().tables)) return;
  // The toast that offers the review would lie over the dialog.
  if (ui.toast) ui.dismissToast(ui.toast.id);
  ui.openDialog({ kind: 'review-inferred' });
}

/**
 * "Arrange tables" in the toolbar and the canvas menu: moves every table to where its
 * relationships put it and shows the whole diagram. While several tables are selected it arranges
 * only them, among themselves and where they are, and the canvas stays as it is.
 */
export function arrangeTables() {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  if (!schema.tables.length) return;
  const visible = visibleNames(schema.tables, suggestModules(schema.tables), currentShown());
  const visibleSet = new Set(visible);
  const multi = schema.selection.length > 1;
  const picked = multi ? schema.selection.filter((name) => visibleSet.has(name)) : visible;
  const only = multi || visible.length < schema.tables.length ? picked : undefined;
  if (multi && !picked.length) return;
  const moved = schema.arrangeTables(only);
  if (!multi) ui.setFitPending(true);
  if (!moved) {
    ui.showToast({ tone: 'info', title: multi ? t('toast.arranged.alreadySelected') : t('toast.arranged.already') });
    return;
  }
  ui.showToast(
    multi
      ? {
          title: t('toast.arrangedSelected.title', { count: picked.length }),
          description: t('toast.arrangedSelected.description'),
        }
      : {
          title: t('toast.arranged.title', { count: picked.length }),
          description: t('toast.arranged.description'),
        },
  );
}

/** "Remove inferred relationships" in the canvas menu. */
export function removeInferredRelationships() {
  const removed = useSchemaStore.getState().removeInferred();
  if (!removed) return;
  useUiStore.getState().showToast({
    tone: 'info',
    title: t('toast.inferredRemoved.title', { count: removed }),
    description: t('toast.inferredRemoved.description'),
  });
}

/** "Table groups…" in the canvas menu and the inspector: opens the list of the groups and of the ones that are suggested. */
export function requestTableGroups() {
  const ui = useUiStore.getState();
  // A toast would lie over the dialog.
  if (ui.toast) ui.dismissToast(ui.toast.id);
  ui.openDialog({ kind: 'table-groups' });
}

/** The Group field of the inspector: puts the tables into the group called `group`, or into none with null. One undo step. */
export function groupTables(tables: readonly string[], group: string | null) {
  useSchemaStore.getState().editGroups((groups) => assignGroup(groups, tables, group));
}

/**
 * "New group…" in the Group field of the inspector: makes a group of the tables, in one undo step,
 * and opens the dialog in which it is given its label and colour.
 */
export function groupTablesAsNew(tables: readonly string[]) {
  const schema = useSchemaStore.getState();
  if (!schema.editGroups((groups) => assignGroup(groups, tables, newGroupName(groups)))) return;
  requestTableGroups();
}

/**
 * What the tables called `names` (all of them without) show of their columns: every column, the
 * key columns only, none, or the keys of the large tables. One undo step.
 */
export function showColumns(choice: ColumnsChoice, names?: readonly string[]) {
  useSchemaStore.getState().showColumns(choice, names);
}

/**
 * The mode switch of the toolbar. Data opens on the table selected on the diagram, or the first
 * one; a schema without tables has none, and the switch does not offer Data for it.
 */
export function openMode(mode: WorkspaceMode) {
  const { name, tables, selected } = useSchemaStore.getState();
  const route = modeRoute(mode, name, dataTable(tables, selected));
  if (route) go(route);
}

/** "Open in Data": the records of `table`. */
export function openInData(table: string) {
  go({ screen: 'data', schema: useSchemaStore.getState().name, table });
}

/** "Open in Diagram" in the menu of a table's header: back to the diagram, with the table selected. */
export function openInDiagram(table: string) {
  const schema = useSchemaStore.getState();
  // A search or a focus could hide the table from the diagram it is opened in.
  useUiStore.getState().setSearch('');
  showAllTables();
  useSchemaStore.getState().select(table);
  go({ screen: 'workspace', schema: schema.name });
}

/**
 * Structure tab: open the diagram with `table` selected and its column highlighted in the
 * inspector. `column` is the column's name.
 */
export function openColumnInDiagram(table: string, column: string) {
  const schema = useSchemaStore.getState();
  useUiStore.getState().setSearch('');
  showAllTables();
  schema.select(table);
  const t0 = schema.tables.find((x) => x.name === table);
  const index = t0?.columns.findIndex((c) => c.name === column) ?? -1;
  schema.selectColumn(index >= 0 ? index : null);
  go({ screen: 'workspace', schema: schema.name });
}

/** "Copy table name" in the menu of a table's header. */
export async function copyTableName(name: string): Promise<void> {
  const ui = useUiStore.getState();
  try {
    await navigator.clipboard.writeText(name);
    ui.showToast({ tone: 'success', title: t('toast.copiedTableName.title'), description: name });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}

/** Structure tab: copy a column name. */
export async function copyColumnName(name: string): Promise<void> {
  const ui = useUiStore.getState();
  try {
    await navigator.clipboard.writeText(name);
    ui.showToast({ tone: 'success', title: t('toast.copiedColumnName.title'), description: name });
  } catch (error) {
    console.error(error);
    ui.showToast({ tone: 'error', title: t('toast.copyFailed.title'), description: t('toast.copyFailed.description') });
  }
}
