import type { CSSProperties, ReactNode } from 'react';
import { t } from '../core/i18n';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface ToastAction {
  label: string;
  onClick?: () => void;
}

export interface ToastProps {
  tone?: 'success' | 'error' | 'info';
  title: ReactNode;
  description?: ReactNode;
  actions?: ToastAction[];
  /** `false` hides the close button. */
  onClose?: (() => void) | false;
}

export function Toast({ tone = 'success', title, description, actions, onClose }: ToastProps) {
  const icon = tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert' : 'info';
  return (
    <div className={cx('ss-toast', `ss-toast--${tone}`)} role="status">
      <Icon name={icon} size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ss-toast-title">{title}</div>
        {description && <div className="ss-toast-desc">{description}</div>}
        {actions && (
          <div className="ss-toast-actions">
            {actions.map((a, i) => (
              <a key={i} onClick={a.onClick}>
                {a.label}
              </a>
            ))}
          </div>
        )}
      </div>
      {onClose !== false && <IconButton icon="x" size="sm" label={t('toast.dismiss')} onClick={onClose} />}
    </div>
  );
}

export interface AlertProps {
  tone?: 'info' | 'success' | 'warn' | 'error';
  title?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Alert({ tone = 'info', title, action, style, children }: AlertProps) {
  const icon = tone === 'success' ? 'check-circle' : tone === 'error' ? 'alert' : tone === 'warn' ? 'warning' : 'info';
  return (
    <div className={cx('ss-alert', `ss-alert--${tone}`)} role={tone === 'error' ? 'alert' : 'status'} style={style}>
      <Icon name={icon} size={16} style={{ marginTop: 1 }} />
      <div className="ss-alert-body" style={{ flex: 1 }}>
        {title && <div className="ss-alert-title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}
