import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface FieldProps {
  label?: ReactNode;
  aside?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Field({ label, aside, hint, error, className, style, children }: FieldProps) {
  return (
    <div className={cx('ss-field', className)} style={style}>
      {label && (
        <label className="ss-field-label">
          <span>{label}</span>
          {aside && <span className="ss-faint">{aside}</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="ss-field-error" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </div>
      ) : (
        hint && <div className="ss-field-hint">{hint}</div>
      )}
    </div>
  );
}
