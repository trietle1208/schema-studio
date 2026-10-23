import { useEffect, useState } from 'react';
import { t } from '../core/i18n';
import type { SchemaSummary } from '../core/model';
import { filterSidebarSchemas, type SidebarNav } from '../core/sidebar';
import { Avatar } from './Avatar';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import type { IconName } from './icons';
import { Logo } from './Logo';

export interface SidebarProps {
  active?: SidebarNav;
  onNavigate?: (id: SidebarNav) => void;
  schemas?: SchemaSummary[];
  activeSchema?: string;
  onSelectSchema?: (name: string) => void;
  onToggleFavorite?: (name: string, favorite: boolean) => void;
  onNew?: () => void;
  onSettings?: () => void;
  onShortcuts?: () => void;
  onCollapse?: () => void;
  collapsed?: boolean;
  /**
   * On the diagram the sidebar is the icon rail and the panel beside it is the Explorer.
   * `explorer` and `views` are that panel; Schemas leaves the diagram.
   */
  rail?: 'explorer' | 'views';
  onRail?: (id: 'schemas' | 'explorer' | 'views') => void;
  empty?: boolean;
  workspace?: string;
  userName?: string;
  userInitials?: string;
}

export function Sidebar({
  active: activeProp = 'schemas',
  onNavigate,
  schemas = [],
  activeSchema,
  onSelectSchema,
  onToggleFavorite,
  onNew,
  onSettings,
  onShortcuts,
  onCollapse,
  collapsed = false,
  rail,
  onRail,
  empty,
  workspace = t('sidebar.workspace'),
  userName = 'Luong Hoang',
  userInitials = 'LH',
}: SidebarProps) {
  const [active, setActive] = useState<SidebarNav>(activeProp);
  useEffect(() => setActive(activeProp), [activeProp]);

  const isEmpty = empty || schemas.length === 0;
  const favorites = isEmpty ? 0 : schemas.filter((s) => s.favorite).length;
  const visible = isEmpty ? [] : filterSidebarSchemas(schemas, active);
  const sectionLabel =
    active === 'recent' ? t('sidebar.recent') : active === 'favorites' ? t('sidebar.favorites') : t('sidebar.saved');
  const emptyMessage =
    isEmpty
      ? t('sidebar.empty')
      : active === 'recent'
        ? t('sidebar.emptyRecent')
        : active === 'favorites'
          ? t('sidebar.emptyFavorites')
          : t('sidebar.empty');

  const nav: { id: string; icon: IconName; label: string; count?: number }[] = rail
    ? [
        { id: 'schemas', icon: 'layers', label: t('common.schemas') },
        { id: 'explorer', icon: 'database', label: t('explorer.title') },
        { id: 'views', icon: 'bookmark', label: t('explorer.views') },
      ]
    : [
        { id: 'schemas', icon: 'layers', label: t('common.schemas'), count: isEmpty ? 0 : schemas.length },
        { id: 'recent', icon: 'clock', label: t('sidebar.recent') },
        { id: 'favorites', icon: 'star', label: t('sidebar.favorites'), count: favorites || undefined },
      ];

  const goNav = (id: string) => {
    if (rail) {
      onRail?.(id as 'schemas' | 'explorer' | 'views');
      return;
    }
    setActive(id as SidebarNav);
    onNavigate?.(id as SidebarNav);
  };

  return (
    <nav className={cx('ss-sidebar', (collapsed || rail) && 'is-collapsed', rail && 'is-rail')} aria-label={t('sidebar.label')}>
      <div className="ss-sb-brand">
        <Logo markOnly={collapsed} />
        <span className="ss-spacer" />
        <IconButton
          icon="sidebar"
          size="sm"
          label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          onClick={onCollapse}
        />
      </div>
      {!collapsed && (
        <button className="ss-sb-ws" type="button">
          <span className="ss-sb-ws-mark">P</span>
          <span className="ss-sb-ws-name">{workspace}</span>
          <Icon name="chevrons-ud" size={14} className="ss-sb-chevron" />
        </button>
      )}
      <div className="ss-sb-nav">
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            className={cx('ss-nav-item', (rail ? rail === n.id : active === n.id) && 'is-active')}
            title={collapsed || rail ? n.label : undefined}
            onClick={() => goNav(n.id)}
          >
            <Icon name={n.icon} size={16} />
            <span className="ss-sb-label">{n.label}</span>
            {n.count != null && <span className="ss-nav-count">{n.count}</span>}
          </button>
        ))}
      </div>
      <div className="ss-sb-section">
        <span className="ss-caption">{sectionLabel}</span>
        <IconButton icon="plus" size="sm" label={t('sidebar.newSchema')} onClick={onNew} />
      </div>
      {visible.length === 0 ? (
        <div className="ss-sb-list">
          <div className="ss-sb-empty">{emptyMessage}</div>
        </div>
      ) : (
        <div className="ss-sb-list">
          {visible.map((s) => (
            <div key={s.name} className={cx('ss-sb-item', activeSchema === s.name && 'is-active')}>
              <button
                type="button"
                className="ss-sb-item-hit"
                title={collapsed ? s.name : undefined}
                onClick={() => onSelectSchema?.(s.name)}
              >
                <Icon name="database" size={14} />
                <span className="ss-sb-item-body">
                  <span className="ss-sb-item-row">
                    <span className="ss-sb-item-name">{s.name}</span>
                    <span className="ss-sb-item-time">{s.updatedShort ?? s.updated}</span>
                  </span>
                  <span className="ss-sb-item-meta">{`${s.engine} · ${t('count.tables', { count: s.tables })}`}</span>
                </span>
              </button>
              {onToggleFavorite && (
                <IconButton
                  className={cx('ss-sb-item-fav', s.favorite && 'is-on')}
                  icon="star"
                  size="sm"
                  label={s.favorite ? t('sidebar.unfavorite') : t('sidebar.favorite')}
                  onClick={() => onToggleFavorite(s.name, !s.favorite)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <div className="ss-sb-foot">
        <button type="button" className="ss-nav-item" title={collapsed ? t('sidebar.settings') : undefined} onClick={onSettings}>
          <Icon name="settings" size={16} />
          <span className="ss-sb-label">{t('sidebar.settings')}</span>
          <span className="ss-nav-count">⌘,</span>
        </button>
        <button type="button" className="ss-nav-item" title={collapsed ? t('sidebar.shortcuts') : undefined} onClick={onShortcuts}>
          <Icon name="keyboard" size={16} />
          <span className="ss-sb-label">{t('sidebar.shortcuts')}</span>
          <span className="ss-nav-count">⌘/</span>
        </button>
        <button type="button" className="ss-sb-user" title={collapsed ? userName : undefined}>
          <Avatar initials={userInitials} name={userName} />
          <div className="ss-sb-grow">
            <div className="ss-sb-user-name">{userName}</div>
            <div className="ss-sb-user-plan">{t('sidebar.plan')}</div>
          </div>
          <Icon name="chevrons-ud" size={14} className="ss-sb-chevron" />
        </button>
      </div>
    </nav>
  );
}
