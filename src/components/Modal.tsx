import { useEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import type { IconName } from './icons';

const TAB_STOPS =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  iconStyle?: CSSProperties;
  /** Esc, the close button and a click on the scrim call it. */
  onClose?: () => void;
  width?: number;
  footer?: ReactNode;
  footerStart?: ReactNode;
  headerAside?: ReactNode;
  bodyStyle?: CSSProperties;
  children?: ReactNode;
}

/** Keeps Tab inside the dialog, so the screen under the scrim cannot be edited. */
function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'Tab') return;
  const stops = e.currentTarget.querySelectorAll<HTMLElement>(TAB_STOPS);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = document.activeElement;
  const leaving = e.shiftKey ? active === first || active === e.currentTarget : active === last;
  if (!first || !leaving) return;
  e.preventDefault();
  (e.shiftKey ? last : first).focus();
}

export function Modal({
  title,
  subtitle,
  icon,
  iconStyle,
  onClose,
  width = 640,
  footer,
  footerStart,
  headerAside,
  bodyStyle,
  children,
}: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus moves into the dialog while it is open (to the element marked `data-autofocus`, if any)
  // and goes back to where it was on close.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const previous = document.activeElement;
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <div
      className="ss-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialog}
        className="ss-modal"
        role="dialog"
        aria-modal
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        style={{ width }}
        onKeyDown={trapTab}
      >
        <div className="ss-modal-head">
          {icon && (
            <div className="ss-drop-icon" style={{ margin: 0, width: 28, height: 28, ...iconStyle }}>
              <Icon name={icon} size={16} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div className="ss-modal-title">{title}</div>
            {subtitle && <div className="ss-modal-sub">{subtitle}</div>}
          </div>
          {headerAside}
          {onClose && <IconButton icon="x" size="sm" label="Close (Esc)" onClick={onClose} />}
        </div>
        <div className="ss-modal-body" style={bodyStyle}>
          {children}
        </div>
        {(footer || footerStart) && (
          <div className="ss-modal-foot">
            {footerStart}
            <span className="ss-spacer" />
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title: ReactNode;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /** The confirm button and ⌘⏎ (Ctrl + Enter outside macOS) call it. */
  onConfirm?: () => void;
  onCancel?: () => void;
  width?: number;
  children?: ReactNode;
}

export function ConfirmDialog({
  title,
  danger,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  width = 440,
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!onConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm]);

  return (
    <Modal
      title={title}
      width={width}
      onClose={onCancel}
      icon={danger ? 'trash' : 'info'}
      iconStyle={danger ? { background: 'var(--removed-subtle)', color: 'var(--removed)' } : undefined}
      footer={
        <>
          {/* Cancel takes the focus, so a stray Enter never confirms. */}
          <Button onClick={onCancel} kbd="Esc" data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} kbd={['⌘', '⏎']}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
