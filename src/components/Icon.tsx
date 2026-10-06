import type { CSSProperties } from 'react';
import { cx } from './cx';
import { ICONS, type IconName } from './icons';

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, strokeWidth = 1.75, label, className, style }: IconProps) {
  return (
    <svg
      className={cx('ss-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
