import type { ReactNode } from 'react';
import { cx } from './cx';

export interface ButtonGroupProps {
  children?: ReactNode;
  className?: string;
  /** Accessible name for the group. */
  label?: string;
}

/** Joined buttons that share one outer border, with a hairline between each. */
export function ButtonGroup({ children, className, label }: ButtonGroupProps) {
  return (
    <div className={cx('ss-btn-group', className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}
