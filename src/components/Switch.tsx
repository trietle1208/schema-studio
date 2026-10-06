import type { ReactNode } from 'react';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  ariaLabel?: string;
}

export function Switch({ checked, onChange, label, ariaLabel }: SwitchProps) {
  return (
    <label className="ss-switch">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked)}
        aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      />
      <span className="ss-switch-track" />
      {label && <span>{label}</span>}
    </label>
  );
}
