import type { Address } from './address';

export interface MemoryAddress extends Address {
  /** The history entries, oldest first, and which one is current. */
  entries: string[];
  index: number;
  /** What the user does: types an address, or presses Back or Forward. Each tells the watcher. */
  visit(path: string): void;
  back(): void;
  forward(): void;
}

/** An address bar with its history, kept in memory. */
export function memoryAddress(initial = ''): MemoryAddress {
  let watcher: (() => void) | null = null;
  const address: MemoryAddress = {
    entries: [initial],
    index: 0,
    read: () => address.entries[address.index],
    write(path, replace) {
      const hash = `#${path}`;
      if (address.read() === hash) return;
      if (replace) address.entries[address.index] = hash;
      else address.entries.splice(++address.index, Infinity, hash);
    },
    watch(onChange) {
      watcher = onChange;
      return () => {
        watcher = null;
      };
    },
    visit(path) {
      address.entries.splice(++address.index, Infinity, `#${path}`);
      watcher?.();
    },
    back() {
      if (address.index === 0) return;
      address.index--;
      watcher?.();
    },
    forward() {
      if (address.index === address.entries.length - 1) return;
      address.index++;
      watcher?.();
    },
  };
  return address;
}
