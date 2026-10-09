import { flushSync } from 'react-dom';
import { countLines } from '../core/files';
import { EXPORT_ENGINES, generatorFor, tableScript } from '../core/generate';
import { convertTables } from '../core/generate/convert';
import { assignGroup, newGroupName } from '../core/groups';
import { t } from '../core/i18n';
import type { Position } from '../core/model';
import { countInferred, qualifiedName, referenceProblem, referenceTargets, relatedTables, type ColumnRef } from '../core/relations';
import { validateColumns } from '../core/validate';
import { versionLabel } from '../core/versions';
import { undo, useSchemaStore, type SaveResult } from '../store/schema';
import { useUiStore } from '../store/ui';

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
  const schema = useSchemaStore.getState();
  // A search would hide the new table unless its name happened to match, and a focus always would.
  ui.setSearch('');
  schema.focus(null);
  // The inspector has to show the new table before it can be told to rename it.
  flushSync(() => schema.addTable(position));
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
 * "Focus related tables" in the table menu: the canvas shows only the table and the tables one
 * foreign key away from it, fitted to the screen, until "Show all tables" or Esc. A table that is
 * related to no other is not focused on, which a toast says.
 */
export function focusRelatedTables(name: string) {
  const ui = useUiStore.getState();
  const schema = useSchemaStore.getState();
  const related = relatedTables(schema.tables, name).length - 1;
  if (related < 0) return;
  if (!related) {
    ui.showToast({
      tone: 'info',
      title: t('toast.noRelated.title'),
      description: t('toast.noRelated.description', { name }),
    });
    return;
  }
  // A search would hide the related tables whose names do not match.
  ui.setSearch('');
  schema.select(name);
  schema.focus(name);
  ui.setFitPending(true);
}

/** "Show all tables" and Esc: ends the focus. The canvas stays where it is, with the other tables back around it. */
export function showAllTables() {
  useSchemaStore.getState().focus(null);
}

/** The toolbar search. It looks through every table, so typing in it ends a focus. */
export function searchFor(text: string) {
  if (text.trim()) useSchemaStore.getState().focus(null);
  useUiStore.getState().setSearch(text);
}

/**
 * "Infer relationships" in the canvas menu: adds the foreign keys the names of the columns point
 * to, for a schema whose database declares none, and says in a toast how many it found.
 */
export function inferRelationships() {
  const ui = useUiStore.getState();
  const added = useSchemaStore.getState().inferRelations();
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
  const only = schema.selection.length > 1 ? schema.selection : undefined;
  const moved = schema.arrangeTables(only);
  if (!only) ui.setFitPending(true);
  if (!moved) {
    ui.showToast({ tone: 'info', title: only ? t('toast.arranged.alreadySelected') : t('toast.arranged.already') });
    return;
  }
  ui.showToast(
    only
      ? {
          title: t('toast.arrangedSelected.title', { count: only.length }),
          description: t('toast.arrangedSelected.description'),
        }
      : {
          title: t('toast.arranged.title', { count: schema.tables.length }),
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
