/** Where the current route is kept outside the app: the address bar, or a stand-in for it in tests. */
export interface Address {
  /** The path as it stands, e.g. `#/schemas/ecommerce`. */
  read(): string;
  /** Sets the path without telling the watcher. `replace` overwrites the current history entry instead of adding one. */
  write(path: string, replace?: boolean): void;
  /** Calls `onChange` whenever the path changes from outside: back, forward, or an address typed in. Returns how to stop. */
  watch(onChange: () => void): () => void;
}

/** The address bar, with the path after the `#` so that the app works from any location, a file included. */
export const hashAddress: Address = {
  read: () => window.location.hash,
  write(path, replace) {
    const hash = `#${path}`;
    if (window.location.hash === hash) return;
    // Unlike assigning to location.hash, the History API raises no hashchange for the app's own navigation.
    if (replace) window.history.replaceState(null, '', hash);
    else window.history.pushState(null, '', hash);
  },
  watch(onChange) {
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  },
};
