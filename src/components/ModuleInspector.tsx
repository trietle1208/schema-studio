import { useState } from 'react';
import { moduleCards, moduleLinks, moduleOverview, savedModuleGroup } from '../core/diagramView';
import { moduleColor } from '../core/explorer';
import { formatNumber, t } from '../core/i18n';
import type { GroupColor, Table, TableGroup } from '../core/model';
import type { SchemaModule } from '../core/modules';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface ModuleInspectorProps {
  tables: readonly Table[];
  modules: readonly SchemaModule[];
  groups: readonly TableGroup[];
  /** The module selected on the canvas. Null is the overview. */
  selected: string | null;
  hideHubs: boolean;
  inferredOnly: boolean;
  onSelect: (name: string | null) => void;
  onOpen: (tables: readonly string[]) => void;
  /** A table of the module, opened in Focus. */
  onFocus: (table: string) => void;
  onRename: (tables: readonly string[], from: string, to: string, color: GroupColor) => void;
  onSaveGroup: (tables: readonly string[], name: string, color: GroupColor) => void;
}

export function ModuleInspector({
  tables,
  modules,
  groups,
  selected,
  hideHubs,
  inferredOnly,
  onSelect,
  onOpen,
  onFocus,
  onRename,
  onSaveGroup,
}: ModuleInspectorProps) {
  const cards = moduleCards(tables, modules);
  const card = cards.find((item) => item.name === selected);
  if (!card) {
    const overview = moduleOverview(tables, modules);
    return (
      <aside className="ss-inspector ss-mod-ins" aria-label={t('modules.overview')}>
        <div className="ss-insp-head">
          <div className="ss-insp-title">
            <Icon name="layers" size={16} />
            <span className="ss-insp-name" style={{ cursor: 'default' }}>
              {t('modules.overview')}
            </span>
          </div>
        </div>
        <div className="ss-insp-body">
          <section className="ss-insp-sec">
            <div className="ss-focus-stats">
              <div>
                {t('modules.statModules')}
                <b>{formatNumber(overview.modules)}</b>
              </div>
              <div>
                {t('modules.statHubs')}
                <b>{formatNumber(overview.hubs.length)}</b>
              </div>
              <div>
                {t('modules.statNotLinked')}
                <b>{formatNumber(overview.notLinked)}</b>
              </div>
            </div>
          </section>
          {overview.hubs.length > 0 && (
            <section className="ss-insp-sec">
              <div className="ss-focus-sechead">
                <span className="ss-caption">{t('modules.statHubs')}</span>
              </div>
              {overview.hubs.map((hub) => (
                <div key={hub.table} className="ss-focus-rel">
                  <Icon name="hub" size={12} />
                  <span title={hub.table}>{hub.table}</span>
                  <span className="is-on">{formatNumber(hub.referencedBy)}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </aside>
    );
  }

  const index = cards.indexOf(card);
  const saved = savedModuleGroup(groups, card.tables);
  const color = saved?.color ?? moduleColor(card.name, index, groups);
  const title = saved?.name || card.name || t('explorer.other');
  const loose = new Set(modules.find((item) => item.name === card.name)?.notLinked ?? []);
  const links = moduleLinks(tables, card.name, modules, { hideHubs, inferredOnly });

  return (
    <aside className="ss-inspector ss-mod-ins" aria-label={title}>
      <div className="ss-insp-head">
        <ModuleTitle
          key={card.name}
          title={title}
          onRename={(next) => onRename(card.tables, title, next, color)}
        />
        <p className="ss-focus-meta">{t('count.tables', { count: card.tables.length })}</p>
      </div>
      <div className="ss-insp-body">
        <section className="ss-insp-sec">
          <div className="ss-focus-sechead">
            <span className="ss-caption">{t('noun.tables')}</span>
          </div>
          {card.tables.map((name) => (
            <button
              key={name}
              type="button"
              className={cx('ss-mod-ins-table', loose.has(name) && 'is-loose')}
              title={loose.has(name) ? t('explorer.notLinked') : name}
              onClick={() => onFocus(name)}
            >
              <Icon name="table" size={12} />
              <span>{name}</span>
            </button>
          ))}
        </section>
        <section className="ss-insp-sec">
          <div className="ss-focus-sechead">
            <span className="ss-caption">{t('modules.relationships')}</span>
          </div>
          {links.length === 0 ? (
            <p className="ss-mod-ins-empty">{t('modules.noLinks')}</p>
          ) : (
            links.map((link) => {
              const other = cards.find((item) => item.name === link.module);
              const otherTitle = (other && savedModuleGroup(groups, other.tables)?.name) || other?.name || t('explorer.other');
              return (
                <button
                  key={link.module || 'other'}
                  type="button"
                  className="ss-focus-rel"
                  onClick={() => onSelect(link.module)}
                >
                  <Icon name="link" size={12} />
                  <span title={otherTitle}>{otherTitle}</span>
                  <span className="is-on">{formatNumber(link.relationships)}</span>
                </button>
              );
            })
          )}
        </section>
      </div>
      <div className="ss-mod-ins-foot">
        <Button variant="primary" size="sm" onClick={() => onOpen(card.tables)}>
          {t('modules.open')}
        </Button>
        <Button size="sm" icon="folder" onClick={() => onSaveGroup(card.tables, title, color)}>
          {t('modules.saveGroup')}
        </Button>
      </div>
    </aside>
  );
}

/** The module name. A click turns it into the field that renames it, the way a table name does. */
function ModuleTitle({ title, onRename }: { title: string; onRename: (next: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next && next !== title) onRename(next);
  }

  return (
    <div className="ss-insp-title">
      <Icon name="layers" size={16} />
      {draft !== null ? (
        <input
          className="ss-insp-name"
          autoFocus
          value={draft}
          spellCheck={false}
          data-local-edit=""
          aria-label={t('modules.renameLabel')}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(null);
            }
          }}
        />
      ) : (
        <button type="button" className="ss-insp-name" onClick={() => setDraft(title)} title={t('modules.rename')}>
          {title}
        </button>
      )}
      <span className="ss-insp-title-actions">
        <IconButton icon="pencil" label={t('modules.rename')} onClick={() => setDraft(title)} />
      </span>
    </div>
  );
}
