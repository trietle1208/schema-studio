import { Fragment, useState } from 'react';
import { savedModuleGroup } from '../core/diagramView';
import { focusPath, focusRelations, focusStats, matchTableName, pathVia, suggestTables, type FocusRelation } from '../core/focusView';
import { formatNumber, t } from '../core/i18n';
import type { Table, TableGroup } from '../core/model';
import type { SchemaModule, SchemaPath } from '../core/modules';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';

export interface FocusInspectorProps {
  table: Table;
  tables: readonly Table[];
  modules: readonly SchemaModule[];
  groups: readonly TableGroup[];
  /** Tables drawn in the Focus view. A relationship to one of them is "on canvas". */
  drawn: ReadonlySet<string>;
  onShow: (table: string) => void;
  onShowPath: (path: SchemaPath) => void;
}

export function FocusInspector({ table, tables, modules, groups, drawn, onShow, onShowPath }: FocusInspectorProps) {
  const [query, setQuery] = useState('');
  const [forTable, setForTable] = useState(table.name);
  if (forTable !== table.name) {
    setForTable(table.name);
    setQuery('');
  }
  const stats = focusStats(tables, table.name);
  const relations = focusRelations(tables, table.name);
  const module = modules.find((item) => item.tables.includes(table.name));
  const saved = module ? savedModuleGroup(groups, module.tables) : undefined;
  const moduleName = saved?.name || module?.name || '';
  const columns = t('focus.columns', { count: table.columns.length });
  const matched = matchTableName(tables, query);
  const path = matched ? focusPath(tables, table.name, matched) : null;
  const suggestions = matched || !query.trim() ? [] : suggestTables(tables, query).filter((name) => name !== table.name);

  return (
    <aside className="ss-inspector ss-focus-ins">
      <div className="ss-insp-head">
        <div className="ss-insp-title">
          <Icon name="table" size={16} />
          <span className="ss-insp-name" style={{ cursor: 'default' }} title={table.name}>
            {table.name}
          </span>
        </div>
        <p className="ss-focus-meta">
          {moduleName ? t('focus.moduleLine', { name: moduleName, columns }) : columns}
        </p>
      </div>
      <div className="ss-insp-body">
        <section className="ss-insp-sec">
          <div className="ss-focus-stats">
            <div>
              {t('focus.refsOut')}
              <b>{formatNumber(stats.refsOut)}</b>
            </div>
            <div>
              {t('focus.refsIn')}
              <b>{formatNumber(stats.refsIn)}</b>
            </div>
            <div>
              {t('focus.twoHop')}
              <b>{formatNumber(stats.twoHop)}</b>
            </div>
          </div>
        </section>
        <section className="ss-insp-sec">
          <div className="ss-focus-sechead">
            <span className="ss-caption">{t('focus.relationships')}</span>
          </div>
          {relations.map((row) => {
            const label = relationLabel(row);
            const on = drawn.has(row.other);
            const known = tables.some((item) => item.name === row.other);
            return (
              <div key={row.key} className="ss-focus-rel">
                <Icon name="link" size={12} />
                <span title={label}>{label}</span>
                {on ? (
                  <span className="is-on">{t('focus.onCanvas')}</span>
                ) : (
                  <button type="button" className="is-add" disabled={!known} onClick={() => onShow(row.other)}>
                    {t('focus.show')}
                  </button>
                )}
              </div>
            );
          })}
        </section>
        <section className="ss-insp-sec">
          <div className="ss-focus-sechead">
            <span className="ss-caption">{t('focus.pathTo')}</span>
          </div>
          <div className="ss-focus-pathbox">
            <Input
              id="ss-focus-path"
              icon="route"
              mono
              value={query}
              placeholder={t('focus.pathPlaceholder')}
              aria-label={t('focus.pathTo')}
              data-local-edit=""
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  if (query) setQuery('');
                  else e.currentTarget.blur();
                } else if (e.key === 'Enter' && path) {
                  e.preventDefault();
                  onShowPath(path);
                }
              }}
            />
            {suggestions.length > 0 && (
              <div className="ss-focus-suggest" role="listbox">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setQuery(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            {path && path.hops.length > 0 && (
              <>
                <div className="ss-focus-path">
                  {path.tables.map((name, index) => (
                    <Fragment key={`${name}-${index}`}>
                      {index > 0 && <i>{path.hops[index - 1].direction === 'out' ? '→' : '←'}</i>}
                      <span>{name}</span>
                    </Fragment>
                  ))}
                </div>
                <p className="ss-focus-via">
                  {t('focus.joins', { count: path.hops.length })}
                  {' · '}
                  {t('focus.via', { columns: pathVia(path) })}
                </p>
              </>
            )}
            {matched && !path && <p className="ss-focus-via">{t('focus.noPath')}</p>}
            <Button size="sm" disabled={!path || path.tables.length < 2} onClick={() => path && onShowPath(path)}>
              {t('focus.showPath')}
            </Button>
          </div>
        </section>
      </div>
    </aside>
  );
}

function relationLabel(row: FocusRelation): string {
  if (row.direction === 'in') return `${row.other}.${row.column}`;
  return row.hub ? `${row.column} → ${row.other} (${t('focus.hub')})` : `${row.column} → ${row.other}`;
}
