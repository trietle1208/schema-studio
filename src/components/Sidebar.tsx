import type { SchemaSummary } from '../core/model';
import { Avatar } from './Avatar';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import type { IconName } from './icons';
import { Logo } from './Logo';

type NavId = 'schemas' | 'recent' | 'favorites';

export interface SidebarProps {
  active?: NavId;
  onNavigate?: (id: string) => void;
  schemas?: SchemaSummary[];
  activeSchema?: string;
  onSelectSchema?: (name: string) => void;
  onNew?: () => void;
  onSettings?: () => void;
  empty?: boolean;
  workspace?: string;
  userName?: string;
  userInitials?: string;
}

/** `2 hours ago` as `2h`, for the narrow time column. Dates such as `Aug 28` stay as they are. */
function shortTime(updated: string): string {
  return updated
    .replace('just now', 'now')
    .replace('Yesterday', '1d')
    .replace(/ (minute|hour|day|week)s? ago/, (_, unit: string) => unit[0]);
}

export function Sidebar({
  active = 'schemas',
  onNavigate,
  schemas = [],
  activeSchema,
  onSelectSchema,
  onNew,
  onSettings,
  empty,
  workspace = 'Personal',
  userName = 'Luong Hoang',
  userInitials = 'LH',
}: SidebarProps) {
  const isEmpty = empty || schemas.length === 0;
  const favorites = isEmpty ? 0 : schemas.filter((s) => s.favorite).length;
  const nav: { id: NavId; icon: IconName; label: string; count?: number }[] = [
    { id: 'schemas', icon: 'layers', label: 'Schemas', count: isEmpty ? 0 : schemas.length },
    { id: 'recent', icon: 'clock', label: 'Recent' },
    { id: 'favorites', icon: 'star', label: 'Favorites', count: favorites || undefined },
  ];
  return (
    <nav className="ss-sidebar" aria-label="Sidebar">
      <div className="ss-sb-brand">
        <Logo />
        <span className="ss-spacer" />
        <IconButton icon="sidebar" size="sm" label="Collapse sidebar (⌘B)" />
      </div>
      <button className="ss-sb-ws" type="button">
        <span className="ss-sb-ws-mark">P</span>
        <span style={{ flex: 1 }}>{workspace}</span>
        <Icon name="chevrons-ud" size={14} style={{ color: 'var(--ink-3)' }} />
      </button>
      <div className="ss-sb-nav">
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            className={cx('ss-nav-item', active === n.id && 'is-active')}
            onClick={() => onNavigate?.(n.id)}
          >
            <Icon name={n.icon} size={16} />
            {n.label}
            {n.count != null && <span className="ss-nav-count">{n.count}</span>}
          </button>
        ))}
      </div>
      <div className="ss-sb-section">
        <span className="ss-caption">Saved schemas</span>
        <IconButton icon="plus" size="sm" label="New schema (⌘N)" onClick={onNew} />
      </div>
      {isEmpty ? (
        <div className="ss-sb-list">
          <div className="ss-sb-empty">No schemas yet. Import a .sql file or start from scratch.</div>
        </div>
      ) : (
        <div className="ss-sb-list">
          {schemas.map((s) => (
            <button
              key={s.name}
              type="button"
              className={cx('ss-sb-item', activeSchema === s.name && 'is-active')}
              onClick={() => onSelectSchema?.(s.name)}
            >
              <Icon name="database" size={14} />
              <span className="ss-sb-item-name">{s.name}</span>
              <span className="ss-sb-item-time">{shortTime(s.updated)}</span>
              <span className="ss-sb-item-meta">{`${s.engine} · ${s.tables} tables`}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ss-sb-foot">
        <button type="button" className="ss-nav-item" onClick={onSettings}>
          <Icon name="settings" size={16} />
          Settings
          <span className="ss-nav-count">⌘,</span>
        </button>
        <button type="button" className="ss-nav-item">
          <Icon name="keyboard" size={16} />
          Keyboard shortcuts
          <span className="ss-nav-count">⌘/</span>
        </button>
        <div className="ss-sb-user">
          <Avatar initials={userInitials} name={userName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ss-sb-user-name">{userName}</div>
            <div className="ss-sb-user-plan">Local workspace</div>
          </div>
          <Icon name="chevrons-ud" size={14} style={{ color: 'var(--ink-3)' }} />
        </div>
      </div>
    </nav>
  );
}
