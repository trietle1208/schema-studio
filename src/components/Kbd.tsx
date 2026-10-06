import type { ReactNode } from 'react';

export interface KbdProps {
  keys?: string[];
  children?: ReactNode;
}

export function Kbd({ keys, children }: KbdProps) {
  const list: ReactNode[] = Array.isArray(keys) ? keys : children != null ? [children] : [];
  if (list.length === 1) return <kbd className="ss-kbd">{list[0]}</kbd>;
  return (
    <span className="ss-kbds">
      {list.map((k, i) => (
        <kbd key={i} className="ss-kbd">
          {k}
        </kbd>
      ))}
    </span>
  );
}
