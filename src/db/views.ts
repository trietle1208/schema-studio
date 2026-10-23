import { diagramViewProblem, type DiagramViewData, type DiagramViewProblem } from '../core/views';
import { db, type DiagramViewRecord } from './db';

/** A name the schema cannot keep a view under. */
export class DiagramViewError extends Error {
  readonly problem: DiagramViewProblem;

  constructor(problem: DiagramViewProblem) {
    super(problem);
    this.name = 'DiagramViewError';
    this.problem = problem;
  }
}

const ofSchema = (schemaId: number) => db.views.where('schemaId').equals(schemaId);

/** The views of a schema, the one saved first first, so ⌘1 stays the first. */
export async function listDiagramViews(schemaId: number): Promise<DiagramViewRecord[]> {
  const rows = await ofSchema(schemaId).toArray();
  return rows.sort((a, b) => a.at - b.at || a.id - b.id);
}

/**
 * Keeps a view under a name. Rejects with nothing written when the name is blank or the schema
 * already has a view of that name.
 */
export function saveDiagramView(schemaId: number, view: DiagramViewData, at = Date.now()): Promise<DiagramViewRecord> {
  return db.transaction('rw', db.views, async () => {
    const problem = diagramViewProblem(view.name, await ofSchema(schemaId).toArray());
    if (problem) throw new DiagramViewError(problem);
    const record: Omit<DiagramViewRecord, 'id'> = {
      schemaId,
      name: view.name.trim(),
      tables: [...view.tables],
      positions: structuredClone(view.positions),
      at,
    };
    const id = await db.views.add(record as DiagramViewRecord);
    return { ...record, id };
  });
}

/**
 * Keeps a view of this name, or replaces the tables and positions of the one the schema already
 * has. The id and the time stay, so its place among ⌘1 to ⌘9 does not move.
 */
export function upsertDiagramView(schemaId: number, view: DiagramViewData, at = Date.now()): Promise<DiagramViewRecord> {
  return db.transaction('rw', db.views, async () => {
    const name = view.name.trim();
    if (!name) throw new DiagramViewError('empty');
    const found = await ofSchema(schemaId).filter((row) => row.name === name).first();
    if (!found) {
      const record: Omit<DiagramViewRecord, 'id'> = {
        schemaId,
        name,
        tables: [...view.tables],
        positions: structuredClone(view.positions),
        at,
      };
      const id = await db.views.add(record as DiagramViewRecord);
      return { ...record, id };
    }
    const next: DiagramViewRecord = {
      ...found,
      tables: [...view.tables],
      positions: structuredClone(view.positions),
    };
    await db.views.put(next);
    return next;
  });
}

/**
 * Gives a view another name. Rejects, with nothing written, when the name is blank or another view
 * of the schema has it. Answers null when this schema has no view with `id`.
 */
export function renameDiagramView(schemaId: number, id: number, name: string): Promise<DiagramViewRecord | null> {
  return db.transaction('rw', db.views, async () => {
    const found = await db.views.get(id);
    if (!found || found.schemaId !== schemaId) return null;
    const problem = diagramViewProblem(name, await ofSchema(schemaId).toArray(), id);
    if (problem) throw new DiagramViewError(problem);
    const next: DiagramViewRecord = { ...found, name: name.trim() };
    await db.views.put(next);
    return next;
  });
}

/** Writes where the view's tables sit. Does nothing when the schema has no view with `id`. */
export function placeDiagramView(schemaId: number, id: number, positions: DiagramViewRecord['positions']): Promise<void> {
  return db.transaction('rw', db.views, async () => {
    const found = await db.views.get(id);
    if (!found || found.schemaId !== schemaId) return;
    await db.views.put({ ...found, positions: structuredClone(positions) });
  });
}

/**
 * Removes a view. Answers the view that was removed, so that it can be put back, or null when the
 * schema has no view with that id.
 */
export function deleteDiagramView(schemaId: number, id: number): Promise<DiagramViewRecord | null> {
  return db.transaction('rw', db.views, async () => {
    const found = await db.views.get(id);
    if (!found || found.schemaId !== schemaId) return null;
    await db.views.delete(id);
    return found;
  });
}

/** Puts a removed view back, with the id and time it had. */
export async function restoreDiagramView(record: DiagramViewRecord): Promise<DiagramViewRecord> {
  await db.views.put(structuredClone(record));
  return record;
}
