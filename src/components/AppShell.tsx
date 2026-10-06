import type { CSSProperties, ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export interface AppShellProps {
  sidebar?: ReactNode | false;
  overlay?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
}

export function AppShell({ sidebar, overlay, style, children }: AppShellProps) {
  return (
    <div className="ss-app ss-root" style={style}>
      {sidebar !== false && (sidebar || <Sidebar />)}
      <div className="ss-main">{children}</div>
      {overlay}
    </div>
  );
}
