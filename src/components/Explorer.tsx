import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  MODULE_PREVIEW,
  UNLINKED_MODULE,
  explorerModules,
  markRange,
  matchedTables,
  matchesOnCanvas,
  moduleColor,
  prefixBuckets,
  searchExplorer,
  shownCount,
  visibleNames,
  indexExplorer,
  type ExplorerScope,
} from '../core/explorer';
import { t } from '../core/i18n';
import type { GroupColor, Table, TableGroup } from '../core/model';
import { suggestModules } from '../core/modules';
import { useUiStore } from '../store/ui';
import { ContextMenu } from './ContextMenu';
import { cx } from './cx';
import { Icon } from './Icon';
import { Input } from './Input';
import { Kbd } from './Kbd';
import { rich } from './rich';

export interface ExplorerView {
  id: number;
  name: string;
  tables: readonly string[];
}

export interface ExplorerProps {
  tables: readonly Table[];
  groups: readonly TableGroup[];
  /** The stored set. Undefined is the default for the size of the schema. */
  shown?: readonly string[];
  selected?: string | null;
  width: number;
  /** `views` replaces the tree with the saved views. The header stays. */
  pane?: 'explorer' | 'views';
  onShown: (names: readonly string[]) => void;
  onSelect: (name: string) => void;
  onHover: (name: string | null) => void;
  onLocate: (name: string) => void;
  onFocus: (name: string) => void;
  onInfer: (name?: string) => void;
  onMove: (table: string, module: string, color: GroupColor) => void;
  onCopy: (name: string) => void;
  /** All modules is the Modules view. It is on while that view is showing. */
  modulesActive?: boolean;
  onModules?: () => void;
  /** Saved views of this schema, oldest first. */
  views?: readonly ExplorerView[];
  /** The view the tables canvas is showing. */
  activeViewId?: number | null;
  onOpenView?: (view: ExplorerView) => void;
  onCreateView?: (name: string) => void;
  onRenameView?: (id: number, name: string) => void;
  onDeleteView?: (view: ExplorerView) => void;
  /** Which schema the open modules belong to, so a different schema starts closed. */
  schemaName?: string;
}

const TYPING = 'input, textarea, select, [contenteditable]';

function Mark({ text, query }: { text: string; query: string }) {
  const range = markRange(text, query);
  if (!range) return text;
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="ss-ex-mark">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </>
  );
}

function Check({ on, mixed, label, onToggle }: { on: boolean; mixed?: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cx('ss-ex-check', (on || mixed) && 'is-on')}
      role="checkbox"
      aria-checked={mixed ? 'mixed' : on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {(on || mixed) && <Icon name={mixed && !on ? 'minus' : 'check'} size={9} />}
    </button>
  );
}

export function Explorer({
  tables,
  groups,
  shown,
  selected,
  width,
  pane = 'explorer',
  onShown,
  onSelect,
  onHover,
  onLocate,
  onFocus,
  onInfer,
  onMove,
  onCopy,
  modulesActive,
  onModules,
  views = [],
  activeViewId = null,
  onOpenView,
  onCreateView,
  onRenameView,
  onDeleteView,
  schemaName,
}: ExplorerProps) {
  const query = useUiStore((s) => s.explorerQuery);
  const scope = useUiStore((s) => s.explorerScope);
  const setQuery = useUiStore((s) => s.setExplorerQuery);
  const setScope = useUiStore((s) => s.setExplorerScope);
  const modules = useMemo(() => suggestModules(tables), [tables]);
  const tree = useMemo(() => explorerModules(tables, modules), [tables, modules]);
  const visible = useMemo(() => visibleNames(tables, modules, shown), [tables, modules, shown]);
  const shownSet = useMemo(() => new Set(visible), [visible]);
  const index = useMemo(() => indexExplorer(tables, modules), [tables, modules]);
  const found = useMemo(() => (query.trim() ? searchExplorer(index, query, scope) : null), [index, query, scope]);
  const byName = useMemo(() => new Map(tables.map((table) => [table.name, table])), [tables]);
  const buckets = useMemo(() => prefixBuckets(tree.unlinked), [tree.unlinked]);

  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [unlinkedOpen, setUnlinkedOpen] = useState(false);
  const [bucketOpen, setBucketOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set());
  const [forced, setForced] = useState<ReadonlySet<string>>(() => new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ table: string; x: number; y: number } | null>(null);
  const [moving, setMoving] = useState<{ table: string; x: number; y: number } | null>(null);
  const [headMenu, setHeadMenu] = useState(false);
  const [naming, setNaming] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  // Open the modules that are already on the canvas once per schema. A later edit keeps what was opened.
  const [openedFor, setOpenedFor] = useState<{ tables: readonly Table[]; schema?: string } | null>(null);
  if (!openedFor || openedFor.tables !== tables || openedFor.schema !== schemaName) {
    setOpenedFor({ tables, schema: schemaName });
    setOpen(new Set(tree.modules.filter((m) => m.tables.some((name) => shownSet.has(name))).map((m) => m.name)));
  }
  const filterKey = `${query}\0${scope}`;
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey);
    setShut(new Set());
    setForced(new Set());
  }

  const apply = (names: readonly string[]) => onShown(names);
  const toggleNames = (members: readonly string[], force?: boolean) => {
    const on = members.filter((name) => shownSet.has(name)).length;
    const show = force ?? on === 0;
    if (show) apply([...shownSet, ...members]);
    else {
      const drop = new Set(members);
      apply([...shownSet].filter((name) => !drop.has(name)));
    }
  };
  const toggleOne = (name: string) => toggleNames([name], !shownSet.has(name));

  const point = (name: string | null) => {
    setHover(name);
    onHover(name);
  };

  const rows = useMemo(() => {
    const list: { id: string; kind: 'module' | 'table' | 'bucket' | 'unlinked'; table?: string; key?: string }[] = [];
    if (found) {
      found.groups.forEach((group, index) => {
        list.push({ id: `g:${group.module}`, kind: 'module', key: group.module });
        const isOpen = (index < 3 && !shut.has(group.module)) || forced.has(group.module);
        if (isOpen) for (const table of group.tables) list.push({ id: `t:${table.table}`, kind: 'table', table: table.table, key: group.module });
      });
      return list;
    }
    if (pane === 'views') return list;
    for (const module of tree.modules) {
      list.push({ id: `m:${module.name}`, kind: 'module', key: module.name });
      if (!open.has(module.name)) continue;
      const all = expanded.has(module.name) || module.tables.length <= MODULE_PREVIEW;
      const members = all ? module.tables : module.tables.slice(0, MODULE_PREVIEW);
      for (const name of members) list.push({ id: `t:${name}`, kind: 'table', table: name, key: module.name });
      if (!all) list.push({ id: `more:${module.name}`, kind: 'module', key: module.name });
    }
    list.push({ id: 'unlinked', kind: 'unlinked' });
    if (unlinkedOpen) {
      buckets.forEach((bucket, index) => {
        const key = bucket.label || `other-${index}`;
        list.push({ id: `b:${key}`, kind: 'bucket', key });
        if (!bucketOpen.has(key)) return;
        for (const name of bucket.tables) list.push({ id: `t:${name}`, kind: 'table', table: name, key });
      });
    }
    return list;
  }, [found, shut, forced, pane, tree, open, expanded, unlinkedOpen, buckets, bucketOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUiStore.getState().dialog) return;
      const target = e.target instanceof Element ? e.target : null;
      const typing = !!target?.closest(TYPING);
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault();
        e.stopPropagation();
        filterRef.current?.focus();
        filterRef.current?.select();
        return;
      }
      if (e.key === 'Escape' && (menu || moving || headMenu)) {
        e.preventDefault();
        e.stopPropagation();
        setMenu(null);
        setMoving(null);
        setHeadMenu(false);
        return;
      }
      if (typing) return;
      const here = rootRef.current?.contains(document.activeElement) || document.activeElement === document.body;
      if (!here && e.key !== 'f' && e.key !== 'F' && e.key !== 'l' && e.key !== 'L') return;
      const at = rows.findIndex((row) => row.id === cursor);
      const current = at >= 0 ? rows[at] : undefined;
      const table = current?.table ?? selected ?? undefined;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!rows.length) return;
        e.preventDefault();
        const next = rows[Math.min(rows.length - 1, Math.max(0, (at < 0 ? -1 : at) + (e.key === 'ArrowDown' ? 1 : -1)))];
        setCursor(next.id);
        rootRef.current?.querySelector(`[data-row="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const key = current?.key;
        if (!key && current?.kind !== 'unlinked') return;
        e.preventDefault();
        const opening = e.key === 'ArrowRight';
        if (current?.kind === 'unlinked') setUnlinkedOpen(opening);
        else if (current?.id.startsWith('b:')) {
          setBucketOpen((set) => {
            const next = new Set(set);
            if (opening) next.add(key!);
            else next.delete(key!);
            return next;
          });
        } else if (current?.id.startsWith('g:')) {
          if (opening) setForced((set) => new Set(set).add(key!));
          else setShut((set) => new Set(set).add(key!));
        } else if (key) {
          setOpen((set) => {
            const next = new Set(set);
            if (opening) next.add(key);
            else next.delete(key);
            return next;
          });
        }
      } else if (e.key === ' ' && current) {
        e.preventDefault();
        if (current.table) toggleOne(current.table);
        else if (current.key) {
          const members = tree.modules.find((m) => m.name === current.key)?.tables ?? buckets.find((b, i) => (b.label || `other-${i}`) === current.key)?.tables;
          if (members) toggleNames(members);
          else if (current.kind === 'unlinked') toggleNames(tree.unlinked);
        } else if (current.kind === 'unlinked') toggleNames(tree.unlinked);
      } else if ((e.key === 'f' || e.key === 'F') && table) {
        e.preventDefault();
        onFocus(table);
      } else if ((e.key === 'l' || e.key === 'L') && table) {
        e.preventDefault();
        onLocate(table);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && table && rootRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        onCopy(table);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const color = (name: string, index: number) => moduleColor(name, index, groups);
  const outside = tables.length - shownSet.size;
  const filterOpen = (module: string, index: number) => (index < 3 && !shut.has(module)) || forced.has(module);

  const chips = (
    <div className="ss-ex-views">
      <button
        type="button"
        className={cx('ss-ex-chip', modulesActive && 'is-on')}
        onClick={() => (onModules ? onModules() : apply(tables.map((table) => table.name)))}
      >
        <Icon name="grid" size={12} />
        {t('explorer.allModules')}
      </button>
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          className={cx('ss-ex-chip', !modulesActive && activeViewId === view.id && 'is-on')}
          onClick={() => onOpenView?.(view)}
        >
          {view.name}
        </button>
      ))}
      {naming ? (
        <input
          className="ss-input ss-ex-viewname"
          autoFocus
          placeholder={t('explorer.viewName')}
          aria-label={t('explorer.viewName')}
          data-local-edit=""
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const name = e.currentTarget.value.trim();
              if (name) onCreateView?.(name);
              setNaming(false);
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              setNaming(false);
            }
          }}
          onBlur={() => setNaming(false)}
        />
      ) : (
        <button type="button" className="ss-ex-chip is-add" onClick={() => setNaming(true)}>
          <Icon name="plus" size={12} />
          {t('explorer.newView')}
        </button>
      )}
    </div>
  );

  const openMenu = (table: string, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCursor(`t:${table}`);
    setMoving(null);
    setMenu({ table, x: e.clientX, y: e.clientY });
  };

  return (
    <aside ref={rootRef} className="ss-explorer" style={{ width }} aria-label={t('explorer.title')} tabIndex={-1}>
      <div className="ss-ex-head">
        <div className="ss-ex-title">
          <Icon name="layers" size={16} />
          {t('explorer.title')}
          <span className="ss-ex-count">{t('count.tables', { count: tables.length })}</span>
          <span className="ss-spacer" />
          <button type="button" className="ss-ex-mini" aria-label={t('explorer.menu')} onClick={() => setHeadMenu((v) => !v)}>
            <Icon name="more" size={15} />
          </button>
          {headMenu && (
            <div className="ss-ex-pop">
              <ContextMenu
                items={[
                  { icon: 'chevron-up', label: t('explorer.collapseAll'), onSelect: () => { setOpen(new Set()); setUnlinkedOpen(false); setBucketOpen(new Set()); } },
                  { icon: 'chevron-down', label: t('explorer.expandAll'), onSelect: () => { setOpen(new Set(tree.modules.map((m) => m.name))); setUnlinkedOpen(true); setExpanded(new Set(tree.modules.map((m) => m.name))); setBucketOpen(new Set(buckets.map((b, i) => b.label || `other-${i}`))); } },
                  { icon: 'refresh', label: t('explorer.redetect'), onSelect: () => { setOpen(new Set(tree.modules.filter((m) => m.tables.some((name) => shownSet.has(name))).map((m) => m.name))); useUiStore.getState().showToast({ title: t('explorer.redetected') }); } },
                ]}
                onClose={() => setHeadMenu(false)}
              />
            </div>
          )}
        </div>
        <Input
          icon="search"
          inputRef={filterRef}
          value={query}
          placeholder={t('explorer.filter')}
          aria-label={t('explorer.filterLabel')}
          data-local-edit=""
          suffix={
            query ? (
              <button type="button" className="ss-ex-mini" aria-label={t('explorer.clearFilter')} onClick={() => { setQuery(''); filterRef.current?.focus(); }}>
                <Icon name="x" size={13} />
              </button>
            ) : (
              <Kbd>/</Kbd>
            )
          }
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              if (query) setQuery('');
              else e.currentTarget.blur();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
              rootRef.current?.focus();
              if (rows[0]) setCursor(rows[0].id);
            }
          }}
        />
        {query.trim() ? (
          <div className="ss-ex-scope" role="tablist" aria-label={t('explorer.filterLabel')}>
            {(['all', 'tables', 'columns'] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={scope === id} className={cx(scope === id && 'is-on')} onClick={() => setScope(id as ExplorerScope)}>
                {t(`explorer.scope.${id}`)}
              </button>
            ))}
            <span className="ss-ex-scope-n">{t('explorer.matches', { count: found?.matches ?? 0 })}</span>
          </div>
        ) : (
          <div>
            <div className="ss-caption ss-ex-cap">{t('explorer.views')}</div>
            {chips}
          </div>
        )}
      </div>

      <div className="ss-ex-list" onMouseLeave={() => point(null)}>
        {pane === 'views' && !found ? (
          <div className="ss-ex-viewlist">
            <button
              type="button"
              className={cx('ss-ex-view', modulesActive && 'is-on')}
              onClick={() => (onModules ? onModules() : apply(tables.map((table) => table.name)))}
            >
              <Icon name="grid" size={14} />
              <span>{t('explorer.allModules')}</span>
              <span className="ss-ex-cols">{tables.length}</span>
            </button>
            {views.map((view, index) => {
              const on = !modulesActive && activeViewId === view.id;
              const shortcut = index < 9 ? `⌘${index + 1}` : '';
              return (
                <div key={view.id} className={cx('ss-ex-viewrow', on && 'is-on')}>
                  {renaming === view.id ? (
                    <input
                      className="ss-input ss-ex-viewname"
                      autoFocus
                      defaultValue={view.name}
                      aria-label={t('explorer.renameView')}
                      data-local-edit=""
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        else if (e.key === 'Escape') {
                          e.stopPropagation();
                          e.currentTarget.dataset.skip = '1';
                          setRenaming(null);
                        }
                      }}
                      onBlur={(e) => {
                        setRenaming(null);
                        if (e.currentTarget.dataset.skip === '1') return;
                        onRenameView?.(view.id, e.currentTarget.value);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={cx('ss-ex-view', on && 'is-on')}
                      title={shortcut ? t('explorer.openView', { shortcut }) : undefined}
                      onClick={() => onOpenView?.(view)}
                    >
                      <Icon name="bookmark" size={14} />
                      <span>{view.name}</span>
                      <span className="ss-ex-cols">{view.tables.length}</span>
                    </button>
                  )}
                  <button type="button" className="ss-ex-mini" aria-label={t('explorer.renameView')} onClick={() => setRenaming(view.id)}>
                    <Icon name="pencil" size={13} />
                  </button>
                  <button type="button" className="ss-ex-mini" aria-label={t('explorer.deleteView')} onClick={() => onDeleteView?.(view)}>
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : found && found.groups.length === 0 ? (
          <div className="ss-ex-empty">
            <p>{t('explorer.noMatch', { query: query.trim() })}</p>
            <button type="button" className="ss-btn ss-btn--secondary ss-btn--sm" onClick={() => setQuery('')}>
              {t('explorer.clearFilter')}
            </button>
          </div>
        ) : found ? (
          found.groups.map((group, index) => {
            const isOpen = filterOpen(group.module, index);
            const label = group.module === UNLINKED_MODULE ? t('explorer.noRelationship') : group.module || t('explorer.other');
            const onCanvas = group.tables.filter((table) => shownSet.has(table.table)).length;
            const dot = color(group.module, tree.modules.findIndex((m) => m.name === group.module));
            return (
              <div key={group.module || `g${index}`}>
                <button
                  type="button"
                  className="ss-ex-group"
                  data-row={`g:${group.module}`}
                  onClick={() => {
                    setCursor(`g:${group.module}`);
                    if (isOpen) {
                      setShut((set) => new Set(set).add(group.module));
                      setForced((set) => {
                        const next = new Set(set);
                        next.delete(group.module);
                        return next;
                      });
                    } else {
                      setForced((set) => new Set(set).add(group.module));
                      setShut((set) => {
                        const next = new Set(set);
                        next.delete(group.module);
                        return next;
                      });
                    }
                  }}
                >
                  <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} />
                  <span className={cx('ss-ex-dot', `ss-group--${dot}`)} />
                  <span className="ss-ex-name">{label}</span>
                  <span className="ss-ex-vis">{onCanvas > 0 ? <><b>{onCanvas}</b>/</> : null}{group.tables.length}</span>
                </button>
                {isOpen &&
                  group.tables.map((table) => (
                    <div
                      key={table.table}
                      className={cx('ss-ex-hit', hover === table.table && 'is-hover', selected === table.table && 'is-selected', cursor === `t:${table.table}` && 'is-current')}
                      data-row={`t:${table.table}`}
                      onMouseEnter={() => point(table.table)}
                      onClick={() => { setCursor(`t:${table.table}`); onSelect(table.table); }}
                      onDoubleClick={() => onLocate(table.table)}
                      onContextMenu={(e) => openMenu(table.table, e)}
                    >
                      <Check on={shownSet.has(table.table)} label={table.table} onToggle={() => toggleOne(table.table)} />
                      <div className="ss-ex-hit-text">
                        <div className="ss-ex-hit-name">
                          <Mark text={table.table} query={table.nameMatch ? query : ''} />
                          {table.nameMatch && <span className="ss-ex-tag">{t('explorer.tableName')}</span>}
                        </div>
                        {table.columns.map((column) => (
                          <div key={column.name} className="ss-ex-hit-col">
                            {column.references && <Icon name="link" size={10} />}
                            <Mark text={column.name} query={query} />
                            {column.references && <span>→ {column.references.table}</span>}
                          </div>
                        ))}
                        {table.nameMatch && !table.columns.length && table.referencedBy > 0 && (
                          <div className="ss-ex-hit-col">{t('explorer.referencedBy', { count: table.referencedBy })}</div>
                        )}
                      </div>
                      <button type="button" className="ss-ex-mini" aria-label={t('explorer.locate')} onClick={(e) => { e.stopPropagation(); onLocate(table.table); }}>
                        {hover === table.table && <Icon name="locate" size={13} />}
                      </button>
                    </div>
                  ))}
              </div>
            );
          })
        ) : (
          <>
            <div className="ss-ex-sec">
              <span className="ss-caption">{t('explorer.modules')}</span>
              <span className="ss-ex-sec-note">{t('explorer.shownOfTotal')}</span>
            </div>
            {tree.modules.map((module, index) => {
              const count = shownCount(module.tables, shownSet);
              const isOpen = open.has(module.name);
              const all = expanded.has(module.name) || module.tables.length <= MODULE_PREVIEW;
              const members = all ? module.tables : module.tables.slice(0, MODULE_PREVIEW);
              const eye = count.shown === 0 ? 'off' : count.shown === count.total ? 'on' : 'part';
              return (
                <div key={module.name || 'other'}>
                  <div className={cx('ss-ex-mod', isOpen && 'is-open')} data-row={`m:${module.name}`}>
                    <button type="button" className="ss-ex-mod-hit" onClick={() => { setCursor(`m:${module.name}`); setOpen((set) => { const next = new Set(set); if (next.has(module.name)) next.delete(module.name); else next.add(module.name); return next; }); }}>
                      <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} />
                      <span className={cx('ss-ex-dot', `ss-group--${color(module.name, index)}`)} />
                      <span className="ss-ex-name">{module.name || t('explorer.other')}</span>
                    </button>
                    <span className="ss-ex-vis">{count.shown > 0 ? <><b>{count.shown}</b>/</> : null}{count.total}</span>
                    <button
                      type="button"
                      className={cx('ss-ex-eye', eye === 'on' && 'is-on', eye === 'part' && 'is-part')}
                      aria-label={count.shown === 0 ? t('explorer.showModule') : t('explorer.hideModule')}
                      onClick={() => toggleNames(module.tables)}
                    >
                      <Icon name={count.shown === 0 ? 'eye-off' : 'eye'} size={14} />
                    </button>
                  </div>
                  {isOpen &&
                    members.map((name) => {
                      const table = byName.get(name);
                      const hot = hover === name;
                      return (
                        <div
                          key={name}
                          className={cx('ss-ex-table', shownSet.has(name) && 'is-on', selected === name && 'is-selected', hot && 'is-hover', cursor === `t:${name}` && 'is-current')}
                          data-row={`t:${name}`}
                          onMouseEnter={() => point(name)}
                          onClick={() => { setCursor(`t:${name}`); onSelect(name); }}
                          onDoubleClick={() => onLocate(name)}
                          onContextMenu={(e) => openMenu(name, e)}
                        >
                          <Check on={shownSet.has(name)} label={name} onToggle={() => toggleOne(name)} />
                          <span className="ss-ex-table-name">{name}</span>
                          {hot ? (
                            <span className="ss-ex-acts">
                              <button type="button" className="ss-ex-mini" aria-label={t('explorer.locate')} onClick={(e) => { e.stopPropagation(); onLocate(name); }}><Icon name="locate" size={13} /></button>
                              <button type="button" className="ss-ex-mini" aria-label={t('explorer.focus')} onClick={(e) => { e.stopPropagation(); onFocus(name); }}><Icon name="focus" size={13} /></button>
                            </span>
                          ) : (
                            <span className="ss-ex-cols">{table?.columns.length ?? 0}</span>
                          )}
                          <button type="button" className="ss-ex-mini" aria-label={t('explorer.rowMenu')} onClick={(e) => openMenu(name, e)}>
                            {hot && <Icon name="more" size={13} />}
                          </button>
                        </div>
                      );
                    })}
                  {isOpen && !all && (
                    <button type="button" className="ss-ex-more" data-row={`more:${module.name}`} onClick={() => setExpanded((set) => new Set(set).add(module.name))}>
                      {t('explorer.more', { count: module.tables.length - MODULE_PREVIEW })}{' '}
                      <span>{t('explorer.showAll', { count: module.tables.length })}</span>
                    </button>
                  )}
                </div>
              );
            })}
            <div className="ss-ex-sec">
              <span className="ss-caption">{t('explorer.notLinked')}</span>
            </div>
            <div className={cx('ss-ex-mod', unlinkedOpen && 'is-open')} data-row="unlinked">
              <button type="button" className="ss-ex-mod-hit" onClick={() => { setCursor('unlinked'); setUnlinkedOpen((v) => !v); }}>
                <Icon name={unlinkedOpen ? 'chevron-down' : 'chevron-right'} size={12} />
                <Icon name="unlink" size={12} />
                <span className="ss-ex-name">{t('explorer.noRelationship')}</span>
              </button>
              <span className="ss-ex-vis">
                {shownCount(tree.unlinked, shownSet).shown > 0 ? <><b>{shownCount(tree.unlinked, shownSet).shown}</b>/</> : null}
                {tree.unlinked.length}
              </span>
              <button
                type="button"
                className={cx('ss-ex-eye', shownCount(tree.unlinked, shownSet).shown === tree.unlinked.length && tree.unlinked.length > 0 && 'is-on', shownCount(tree.unlinked, shownSet).shown > 0 && shownCount(tree.unlinked, shownSet).shown < tree.unlinked.length && 'is-part')}
                aria-label={shownCount(tree.unlinked, shownSet).shown === 0 ? t('explorer.showModule') : t('explorer.hideModule')}
                onClick={() => toggleNames(tree.unlinked)}
              >
                <Icon name={shownCount(tree.unlinked, shownSet).shown === 0 ? 'eye-off' : 'eye'} size={14} />
              </button>
            </div>
            {unlinkedOpen && (
              <p className="ss-ex-note">
                {rich('explorer.unlinkedNote', {
                  action: (
                    <button type="button" onClick={() => onInfer()}>
                      {t('action.inferRelationships')}
                    </button>
                  ),
                })}
              </p>
            )}
            {unlinkedOpen &&
              buckets.map((bucket, index) => {
                const key = bucket.label || `other-${index}`;
                const isOpen = bucketOpen.has(key);
                return (
                  <div key={key}>
                    <button type="button" className="ss-ex-group is-bucket" data-row={`b:${key}`} onClick={() => { setCursor(`b:${key}`); setBucketOpen((set) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }}>
                      <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} />
                      <Icon name="folder" size={12} />
                      <span className="ss-ex-bucket">{bucket.label || t('explorer.other')}</span>
                      <span className="ss-ex-vis">{bucket.tables.length}</span>
                    </button>
                    {isOpen &&
                      bucket.tables.map((name) => {
                        const table = byName.get(name);
                        const hot = hover === name;
                        return (
                          <div
                            key={name}
                            className={cx('ss-ex-table', 'is-deep', shownSet.has(name) && 'is-on', selected === name && 'is-selected', hot && 'is-hover')}
                            data-row={`t:${name}`}
                            onMouseEnter={() => point(name)}
                            onClick={() => { setCursor(`t:${name}`); onSelect(name); }}
                            onDoubleClick={() => onLocate(name)}
                            onContextMenu={(e) => openMenu(name, e)}
                          >
                            <Check on={shownSet.has(name)} label={name} onToggle={() => toggleOne(name)} />
                            <span className="ss-ex-table-name">{name}</span>
                            <span className="ss-ex-cols">{table?.columns.length ?? 0}</span>
                            <button type="button" className="ss-ex-mini" aria-label={t('explorer.rowMenu')} onClick={(e) => openMenu(name, e)}>
                              {hot && <Icon name="more" size={13} />}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
          </>
        )}
      </div>

      {found && found.groups.length > 0 ? (
        <div className="ss-ex-bulk">
          <div>
            <b>{t('explorer.matches', { count: found.matches })}</b>
            {' · '}
            {t('explorer.already', { count: matchesOnCanvas(found, shownSet) })}
          </div>
          <div className="ss-ex-bulk-row">
            <button type="button" className="ss-btn ss-btn--primary ss-btn--sm" onClick={() => apply([...shownSet, ...matchedTables(found)])}>
              <Icon name="eye" size={14} />
              {t('explorer.showMatches', { count: found.matches })}
            </button>
            {found.named && (
              <button type="button" className="ss-btn ss-btn--secondary ss-btn--sm" onClick={() => onFocus(found.named!)}>
                <Icon name="focus" size={14} />
                {t('explorer.focusNamed', { name: found.named })}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="ss-ex-foot">
          <Icon name="table" size={14} />
          <span>
            <b>{shownSet.size}</b> {t('explorer.onCanvas')}
            {outside > 0 && (
              <>
                {' · '}
                <b>{outside}</b> {t('explorer.outside')}
              </>
            )}
          </span>
          <span className="ss-spacer" />
          <button type="button" className="ss-ex-link" onClick={() => apply([])}>
            {t('explorer.hideAll')}
          </button>
        </div>
      )}

      {menu && (
        <div className="ss-ex-menu" style={{ left: menu.x, top: menu.y }}>
          <ContextMenu
            label={`${menu.table} · ${t('count.columns', { count: byName.get(menu.table)?.columns.length ?? 0 })}`}
            items={[
              {
                icon: shownSet.has(menu.table) ? 'eye-off' : 'eye',
                label: t(shownSet.has(menu.table) ? 'explorer.menu.hide' : 'explorer.menu.show'),
                shortcut: 'Space',
                active: !shownSet.has(menu.table),
                onSelect: () => toggleOne(menu.table),
              },
              { icon: 'focus', label: t('explorer.menu.focus'), shortcut: 'F', onSelect: () => onFocus(menu.table) },
              { icon: 'locate', label: t('explorer.menu.locate'), shortcut: 'L', onSelect: () => onLocate(menu.table) },
              '-',
              { icon: 'folder', label: t('explorer.menu.move'), onSelect: () => setMoving({ table: menu.table, x: menu.x, y: menu.y }) },
              { icon: 'wand', label: t('explorer.menu.infer'), onSelect: () => onInfer(menu.table) },
              '-',
              { icon: 'copy', label: t('explorer.menu.copy'), shortcut: '⌘C', onSelect: () => onCopy(menu.table) },
            ]}
            onClose={() => setMenu(null)}
          />
        </div>
      )}
      {moving && (
        <div className="ss-ex-menu" style={{ left: moving.x + 16, top: moving.y }}>
          <ContextMenu
            label={t('explorer.menu.move')}
            items={tree.modules.map((module, index) => ({
              label: module.name || t('explorer.other'),
              onSelect: () => onMove(moving.table, module.name || t('explorer.other'), color(module.name, index)),
            }))}
            onClose={() => setMoving(null)}
          />
        </div>
      )}
    </aside>
  );
}
