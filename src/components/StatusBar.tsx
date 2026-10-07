import type { ReactNode } from 'react';

export interface StatusBarProps {
  left?: ReactNode[];
  right?: ReactNode[];
}

export function StatusBar({ left = [], right = [] }: StatusBarProps) {
  return (
    <footer className="ss-status">
      {left.map((item, i) => (
        <span key={`l${i}`} className="ss-status-item">
          {item}
        </span>
      ))}
      <span className="ss-spacer" />
      {right.map((item, i) => (
        <span key={`r${i}`} className="ss-status-item">
          {item}
        </span>
      ))}
    </footer>
  );
}
