import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export type RadioProps = CheckboxProps;

function Check({ radio, checked, onChange, label, description, disabled, name, className }: CheckboxProps & { radio?: boolean }) {
  return (
    <label className={cx('ss-check', radio && 'ss-check--radio', className)}>
      <input
        type={radio ? 'radio' : 'checkbox'}
        name={name}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="ss-check-box">{!radio && checked && <Icon name="check" size={11} strokeWidth={3} />}</span>
      <span>
        {label}
        {description && <span className="ss-check-desc">{description}</span>}
      </span>
    </label>
  );
}

export function Checkbox(props: CheckboxProps) {
  return <Check {...props} />;
}

export function Radio(props: RadioProps) {
  return <Check {...props} radio />;
}
