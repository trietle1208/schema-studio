import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Handlers for each of many items that stay the same functions from one render to the next, so
 * that an item whose own props did not change is not drawn again (see `memo`). `actions` are what
 * the handlers do; they always do what the latest render says, whichever render made the handler.
 * `make` builds the handlers of one item from its key and a getter of the current `actions`, and
 * must be the same function every time. A new `version` throws the handlers made so far away.
 */
export function useStableHandlers<Actions, Handlers, Version = undefined>(
  actions: Actions,
  make: (key: string, current: () => Actions, version: Version) => Handlers,
  version?: Version,
): (key: string) => Handlers {
  const latest = useRef(actions);
  useLayoutEffect(() => {
    latest.current = actions;
  });
  const cache = useRef({ version, handlers: new Map<string, Handlers>() });
  return useCallback(
    (key) => {
      if (cache.current.version !== version) cache.current = { version, handlers: new Map() };
      let handlers = cache.current.handlers.get(key);
      if (!handlers) {
        handlers = make(key, () => latest.current, version as Version);
        cache.current.handlers.set(key, handlers);
      }
      return handlers;
    },
    [make, version],
  );
}
