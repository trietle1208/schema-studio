import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  icon?: IconName;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  block?: boolean;
}

export function SegmentedControl({ options, value, onChange, block }: SegmentedControlProps) {
  return (
    <div className={cx('ss-seg', block && 'ss-seg--block')} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          disabled={o.disabled}
          className={cx('ss-seg-item', value === o.value && 'is-active')}
          onClick={() => onChange?.(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
          {o.badge && <Badge sans>{o.badge}</Badge>}
        </button>
      ))}
    </div>
  );
}
