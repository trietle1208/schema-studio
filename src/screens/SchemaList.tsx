import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ContextMenu } from '../components/ContextMenu';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Input } from '../components/Input';
import { Kbd } from '../components/Kbd';
import { rich } from '../components/rich';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { t } from '../core/i18n';
import {
  DEFAULT_SCHEMA_SORT,
  ENGINES,
  filterSchemas,
  initialSortDirection,
  sortSchemas,
  stepSelection,
  type SchemaSort,
  type SchemaSortKey,
} from '../core/schemaList';
import { relativeTime } from '../core/time';
import { versionLabel } from '../core/versions';
import type { SchemaRecord } from '../db/db';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { go } from './navigation';
import { requestExportStored } from './exportActions';
import { requestDeleteSchema, requestImport, requestNewSchema } from './schemaActions';

const ALL_ENGINES = 'all';
// The menu's minimum width in bundle.css; it opens under the More button, right edges aligned.
const MENU_WIDTH = 220;

/** The open row menu: the schema it is for and where on the screen it goes. */
interface RowMenu {
  id: number;
  left: number;
  top: number;
}

const engineOptions = () => [{ value: ALL_ENGINES, label: t('common.all') }, ...ENGINES.map((e) => ({ value: e, label: e }))];

const sortOptions = (): { value: SchemaSortKey; label: string }[] => [
  { value: 'updatedAt', label: t('schemas.sort.updated') },
  { value: 'name', label: t('field.name') },
  { value: 'tables', label: t('schemas.sort.tables') },
  { value: 'version', label: t('schemas.version') },
];

type ColumnKey = SchemaSortKey | 'actions';

export interface SchemaListProps {
  /** Every stored schema; undefined while they are being read. */
  schemas: SchemaRecord[] | undefined;
  /** The time the "Updated" column counts back from. */
  now: number;
}

export function SchemaList({ schemas, now }: SchemaListProps) {
  const openId = useSchemaStore((s) => s.id);
  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState(ALL_ENGINES);
  const [sort, setSort] = useState<SchemaSort>(DEFAULT_SCHEMA_SORT);
  // The row the keyboard acts on. It starts on the schema that is open in the workspace.
  const [selectedId, setSelectedId] = useState<number | null>(openId);
  const [menu, setMenu] = useState<RowMenu | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const page = useRef<HTMLDivElement>(null);

  const rows = useMemo(
    () => sortSchemas(filterSchemas(schemas ?? [], query, engine === ALL_ENGINES ? undefined : engine), sort),
    [schemas, query, engine, sort],
  );

  // The row menu closes on Esc, on a press outside it and when the list scrolls under it.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  // ↑ ↓ move the selection, ⏎ opens it and ⌫ deletes it; ↑ ↓ and ⏎ also work while typing in the
  // search box. / goes to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUiStore.getState().dialog || menu || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const inSearch = target === searchRef.current;
      // Any other control keeps its own keys.
      if (!inSearch && target?.closest('input, textarea, select, button, [role="button"], [contenteditable]')) return;

      if (e.key === '/' && !inSearch) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const ids = rows.map((r) => r.id);
        setSelectedId((current) => stepSelection(ids, current, e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Enter') {
        const selected = rows.find((r) => r.id === selectedId);
        if (selected) go({ screen: 'workspace', schema: selected.name });
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && !inSearch) {
        const selected = rows.find((r) => r.id === selectedId);
        if (!selected) return;
        e.preventDefault();
        requestDeleteSchema(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, selectedId, menu]);

  useEffect(() => {
    page.current?.querySelector('.ss-table tr.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (!schemas) return null;

  if (schemas.length === 0) {
    return (
      <>
        <header className="ss-toolbar">
          <div className="ss-tb-crumb">
            <span style={{ color: 'var(--ink-1)' }}>{t('common.schemas')}</span>
          </div>
          <span className="ss-page-count">0</span>
        </header>
        <EmptyState onImport={requestImport} onCreate={requestNewSchema} />
      </>
    );
  }

  // A menu for a schema that has since been deleted or filtered out is not shown.
  const menuFor = menu && rows.find((r) => r.id === menu.id);

  const columns: DataTableColumn<SchemaRecord, ColumnKey>[] = [
    {
      key: 'name',
      label: t('field.name'),
      render: (r) => (
        <div className="ss-row" style={{ gap: 10 }}>
          <span className="ss-drop-icon" style={{ width: 28, height: 28, margin: 0, background: 'var(--bg-4)' }}>
            <Icon name="database" size={14} />
          </span>
          <div>
            <div className="ss-row" style={{ gap: 6 }}>
              <span className="ss-mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
                {r.name}
              </span>
            </div>
            {r.description && (
              <div className="ss-faint" style={{ fontSize: 12, lineHeight: '16px' }}>
                {r.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    { key: 'engine', label: t('field.database'), width: 150, render: (r) => <Badge dot>{r.engine}</Badge> },
    {
      key: 'tables',
      label: t('noun.tables'),
      width: 110,
      numeric: true,
      align: 'right',
      render: (r) => (
        <span>
          {r.tables}
          <span className="ss-faint">{` ${t('unit.tables', { count: r.tables })}`}</span>
        </span>
      ),
    },
    { key: 'relationships', label: t('schemas.relations'), width: 110, numeric: true, align: 'right' },
    {
      key: 'version',
      label: t('schemas.version'),
      width: 100,
      render: (r) => <Badge tone={r.id === selectedId ? 'accent' : 'neutral'}>{versionLabel(r.version)}</Badge>,
    },
    {
      key: 'updatedAt',
      label: t('schemas.updated'),
      width: 140,
      render: (r) => <span className="ss-muted">{relativeTime(r.updatedAt, now)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: 120,
      sortable: false,
      render: (r) => (
        // A double click on a button is not a double click on the row.
        <div className="ss-table-actions" onDoubleClick={(e) => e.stopPropagation()}>
          <IconButton
            icon="history"
            label={t('schemas.history')}
            size="sm"
            onClick={() => go({ screen: 'history', schema: r.name })}
          />
          <IconButton icon="download" label={t('common.export')} size="sm" onClick={() => void requestExportStored(r)} />
          <IconButton
            icon="more"
            label={t('schemas.more')}
            size="sm"
            active={menu?.id === r.id}
            // The press that opens the menu must not count as a press outside it.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              const button = e.currentTarget.getBoundingClientRect();
              setSelectedId(r.id);
              setMenu(menu?.id === r.id ? null : { id: r.id, left: button.right - MENU_WIDTH, top: button.bottom + 4 });
            }}
          />
        </div>
      ),
    },
  ];

  const sorts = sortOptions();

  return (
    <div className="ss-page" ref={page}>
      <div className="ss-page-head">
        <div className="ss-page-title">{t('common.schemas')}</div>
        <span className="ss-page-count">{t('schemas.count', { shown: rows.length, total: schemas.length })}</span>
        <span className="ss-spacer" />
        <Button icon="upload" kbd={['⌘', 'I']} onClick={requestImport}>
          {t('schemas.import')}
        </Button>
        <Button variant="primary" icon="plus" kbd={['⌘', 'N']} onClick={requestNewSchema}>
          {t('action.newSchema')}
        </Button>
      </div>
      <div className="ss-page-tools">
        <div style={{ width: 320 }}>
          <Input
            icon="search"
            placeholder={t('schemas.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Esc clears the search first, then leaves the field.
              if (e.key !== 'Escape') return;
              if (query) setQuery('');
              else e.currentTarget.blur();
            }}
            suffix={<Kbd>/</Kbd>}
            inputRef={searchRef}
            spellCheck={false}
            aria-label={t('schemas.searchLabel')}
          />
        </div>
        <SegmentedControl value={engine} onChange={setEngine} options={engineOptions()} />
        <span className="ss-spacer" />
        <span className="ss-faint" style={{ fontSize: 12 }}>
          {t('schemas.sort')}
        </span>
        <div style={{ width: 150 }}>
          <Select
            size="sm"
            label={t('schemas.sort')}
            value={sort.key}
            onChange={(key) => setSort({ key: key as SchemaSortKey, dir: initialSortDirection(key as SchemaSortKey) })}
            options={
              // A header can sort by a column the menu does not list.
              sorts.some((o) => o.value === sort.key)
                ? sorts
                : [...sorts, { value: sort.key, label: sort.key === 'engine' ? t('field.database') : t('schemas.relations') }]
            }
          />
        </div>
      </div>
      <div className="ss-page-body">
        <DataTable
          rowKey="id"
          selectedKey={selectedId}
          onRowClick={(r) => setSelectedId(r.id)}
          onRowDoubleClick={(r) => go({ screen: 'workspace', schema: r.name })}
          sort={sort}
          onSort={(next) => {
            if (next.key === 'actions') return;
            // A column that was not sorted starts in its own direction; a second click turns it round.
            setSort(next.key === sort.key ? { key: next.key, dir: next.dir } : { key: next.key, dir: initialSortDirection(next.key) });
          }}
          rows={rows}
          columns={columns}
        />
        {rows.length === 0 && (
          <div className="ss-faint" style={{ fontSize: 13, padding: '18px 12px' }}>
            {t('schemas.noMatch')}
          </div>
        )}
        <div className="ss-row ss-faint" style={{ fontSize: 12, padding: '14px 12px' }}>
          <Icon name="folder" size={14} />
          {t('schemas.storedLocally')}
          <span className="ss-spacer" />
          {rich('schemas.keys', {
            move: (
              <>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </>
            ),
            open: <Kbd>⏎</Kbd>,
          })}
        </div>
      </div>
      {menuFor && menu && (
        <div style={{ position: 'fixed', left: menu.left, top: menu.top, zIndex: 20 }}>
          <ContextMenu
            label={menuFor.name}
            onClose={() => setMenu(null)}
            items={[
              { icon: 'external', label: t('schemas.open'), shortcut: '⏎', onSelect: () => go({ screen: 'workspace', schema: menuFor.name }) },
              '-',
              {
                icon: 'trash',
                label: t('action.deleteSchema'),
                shortcut: '⌫',
                danger: true,
                onSelect: () => requestDeleteSchema(menuFor),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
