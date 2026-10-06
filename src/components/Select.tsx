import type { CSSProperties } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange?: (value: string) => void;
  options: (string | SelectOption)[];
  mono?: boolean;
  size?: 'md' | 'sm';
  label?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Select({ value, onChange, options, mono, size, label, disabled, className, style }: SelectProps) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className={cx('ss-select', mono && 'ss-select--mono', size === 'sm' && 'ss-select--sm', className)} style={style}>
      <select value={value} onChange={(e) => onChange?.(e.target.value)} aria-label={label} disabled={disabled}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} />
    </div>
  );
}
