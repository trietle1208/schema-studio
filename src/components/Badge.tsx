import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'pk' | 'fk' | 'added' | 'modified' | 'removed' | 'outline';
  dot?: boolean;
  icon?: IconName;
  sans?: boolean;
  title?: string;
  className?: string;
  children?: ReactNode;
}

export function Badge({ tone = 'neutral', dot, icon, sans, title, className, children }: BadgeProps) {
  return (
    <span className={cx('ss-badge', `ss-badge--${tone}`, sans && 'ss-badge--sans', className)} title={title}>
      {dot && <span className="ss-badge-dot" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
