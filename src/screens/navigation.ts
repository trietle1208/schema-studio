import { parseRoute, routePath, routeSchema, sameRoute, SCHEMAS_ROUTE, type Route } from '../core/routes';
import { openLatestSchema, openSchemaNamed, type StoredSchema } from '../db/schemas';
import { hashAddress, type Address } from '../store/address';
import { selectDirty, useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

// The route on screen lives in the UI store and is mirrored in the address bar. The app's own
// navigation shows a route and then writes the address; a change of the address from outside
// (back, forward, a typed address) is read and shown, or put back when it cannot be.

let address: Address = hashAddress;
let stopWatching: (() => void) | null = null;
/** Counts the routes being entered, so that a slow read does not override a later navigation. */
let turns = 0;

/** Whether the schema called `name` is the one open in the workspace. */
function isOpen(name: string): boolean {
  const open = useSchemaStore.getState();
  return open.id !== null && open.name === name;
}

/** Whether showing `route` drops unsaved changes: it is about another schema than the one being edited. */
function dropsChanges(route: Route): boolean {
  const name = routeSchema(route);
  return name !== null && !isOpen(name) && selectDirty(useSchemaStore.getState());
}

/** Makes a stored schema the open one. Its unsaved predecessor is gone after this. */
export function openStored({ schema, snapshot }: StoredSchema) {
  useSchemaStore.getState().load({
    id: schema.id,
    name: schema.name,
    engine: schema.engine,
    version: schema.version,
    ...snapshot,
  });
  // The search filtered the tables of the schema that was open.
  useUiStore.getState().setSearch('');
}

/**
 * Shows `route`, first reading its schema when that is not the open one, and writes the address.
 * Resolves with whether the route is on screen; a schema that cannot be opened is reported in a toast.
 */
async function enter(route: Route, replace = false): Promise<boolean> {
  const ui = useUiStore.getState();
  const turn = ++turns;
  const name = routeSchema(route);
  if (name !== null && !isOpen(name)) {
    let stored: StoredSchema | undefined;
    try {
      stored = await openSchemaNamed(name);
    } catch (error) {
      console.error(error);
      ui.showToast({
        tone: 'error',
        title: 'Could not open schema',
        description: 'It could not be read from browser storage.',
      });
      return false;
    }
    if (turn !== turns) return false;
    if (!stored) {
      ui.showToast({ tone: 'error', title: 'Schema not found', description: `No schema is called "${name}".` });
      return false;
    }
    openStored(stored);
  }
  ui.setRoute(route);
  address.write(routePath(route), replace);
  return true;
}

/**
 * Goes to `route`. When that would replace a schema with unsaved changes, a dialog asks first and
 * nothing happens until the changes are given up.
 */
export function go(route: Route) {
  if (dropsChanges(route)) useUiStore.getState().openDialog({ kind: 'discard-changes', onDiscard: () => void enter(route) });
  else void enter(route);
}

/** The address changed from outside the app. */
function onAddressChange() {
  const ui = useUiStore.getState();
  const current = ui.route;
  const route = parseRoute(address.read());
  // An address that is no route is put right, and the screen stays.
  if (!route) return address.write(routePath(current), true);
  if (sameRoute(route, current)) return;
  // Whatever dialog was open belonged to the screen being left.
  ui.closeDialog();
  if (dropsChanges(route)) {
    // The address goes back to what is on screen until the question is answered.
    address.write(routePath(current), true);
    ui.openDialog({ kind: 'discard-changes', onDiscard: () => void enter(route) });
    return;
  }
  void enter(route, true).then((shown) => {
    // The address does not stay on a route that is not on screen.
    if (!shown) address.write(routePath(useUiStore.getState().route), true);
  });
}

/**
 * Shows the route in the address bar and follows the address from then on. An address that is no
 * route, or names a schema that cannot be opened, becomes the schema saved last; with nothing
 * stored, or a database that cannot be read, it becomes the schema list. Never rejects.
 */
export async function startRouting(to: Address = hashAddress): Promise<void> {
  stopWatching?.();
  address = to;
  const ui = useUiStore.getState();
  const asked = parseRoute(address.read());
  if (!asked || !(await enter(asked, true))) {
    let route = SCHEMAS_ROUTE;
    try {
      const latest = await openLatestSchema();
      if (latest) {
        openStored(latest);
        route = { screen: 'workspace', schema: latest.schema.name };
      }
    } catch (error) {
      console.error(error);
      ui.showToast({
        tone: 'error',
        title: 'Could not open saved schemas',
        description: 'Browser storage is unavailable, so nothing can be opened or saved.',
      });
    }
    turns++;
    ui.setRoute(route);
    address.write(routePath(route), true);
  }
  stopWatching = address.watch(onAddressChange);
}
