import type { CSSProperties } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface MenuItem {
  icon?: IconName;
  label: string;
  shortcut?: string;
  danger?: boolean;
  active?: boolean;
  onSelect?: () => void;
}

export interface ContextMenuProps {
  items: (MenuItem | '-')[];
  label?: string;
  onClose?: () => void;
  style?: CSSProperties;
}

export function ContextMenu({ items, label, onClose, style }: ContextMenuProps) {
  return (
    <div className="ss-menu" role="menu" style={style} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {label && <div className="ss-menu-label">{label}</div>}
      {items.map((it, i) =>
        it === '-' ? (
          <div key={i} className="ss-menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={cx('ss-menu-item', it.danger && 'is-danger', it.active && 'is-active')}
            onClick={() => {
              it.onSelect?.();
              onClose?.();
            }}
          >
            {it.icon ? <Icon name={it.icon} size={14} /> : <span style={{ width: 14 }} />}
            {it.label}
            {it.shortcut && <span className="ss-menu-sc">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
