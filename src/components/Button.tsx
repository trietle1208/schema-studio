import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Kbd } from './Kbd';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
  size?: 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  kbd?: string | string[];
  active?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size,
  icon,
  iconRight,
  kbd,
  active,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconOnly = icon && (children == null || children === false);
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'ss-btn',
        `ss-btn--${variant}`,
        size === 'sm' && 'ss-btn--sm',
        iconOnly && 'ss-btn--icon',
        active && 'is-active',
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} />}
      {kbd && <Kbd keys={([] as string[]).concat(kbd)} />}
    </button>
  );
}
