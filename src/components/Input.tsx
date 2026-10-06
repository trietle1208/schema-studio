import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  icon?: IconName;
  suffix?: ReactNode;
  mono?: boolean;
  size?: 'md' | 'sm';
  error?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

export function Input({ icon, suffix, mono, size, error, inputRef, className, ...rest }: InputProps) {
  const input = (
    <input
      type="text"
      {...rest}
      ref={inputRef}
      aria-invalid={error ? true : undefined}
      className={cx(
        'ss-input',
        mono && 'ss-input--mono',
        size === 'sm' && 'ss-input--sm',
        icon && 'ss-input--icon',
        !!suffix && 'ss-input--suffix',
        error && 'ss-input--error',
        className,
      )}
    />
  );
  if (!icon && !suffix) return input;
  return (
    <div className="ss-input-wrap">
      {icon && <Icon name={icon} size={14} />}
      {input}
      {suffix && <span className="ss-input-suffix">{suffix}</span>}
    </div>
  );
}
