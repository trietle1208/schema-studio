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
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
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
import { openSchema, requestDeleteSchema, requestNewSchema } from './schemaActions';

const ALL_ENGINES = 'all';
// The menu's minimum width in bundle.css; it opens under the More button, right edges aligned.
const MENU_WIDTH = 220;

/** The open row menu: the schema it is for and where on the screen it goes. */
interface RowMenu {
  id: number;
  left: number;
  top: number;
}

const ENGINE_OPTIONS = [{ value: ALL_ENGINES, label: 'All' }, ...ENGINES.map((e) => ({ value: e, label: e }))];

const SORT_OPTIONS: { value: SchemaSortKey; label: string }[] = [
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'tables', label: 'Table count' },
  { value: 'version', label: 'Version' },
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
        if (selected) openSchema(selected.id);
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
            <span style={{ color: 'var(--ink-1)' }}>Schemas</span>
          </div>
          <span className="ss-page-count">0</span>
        </header>
        <EmptyState onCreate={requestNewSchema} />
      </>
    );
  }

  // A menu for a schema that has since been deleted or filtered out is not shown.
  const menuFor = menu && rows.find((r) => r.id === menu.id);

  const columns: DataTableColumn<SchemaRecord, ColumnKey>[] = [
    {
      key: 'name',
      label: 'Name',
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
    { key: 'engine', label: 'Database', width: 150, render: (r) => <Badge dot>{r.engine}</Badge> },
    {
      key: 'tables',
      label: 'Tables',
      width: 110,
      numeric: true,
      align: 'right',
      render: (r) => (
        <span>
          {r.tables}
          <span className="ss-faint">{r.tables === 1 ? ' table' : ' tables'}</span>
        </span>
      ),
    },
    { key: 'relationships', label: 'Relations', width: 110, numeric: true, align: 'right' },
    {
      key: 'version',
      label: 'Version',
      width: 100,
      render: (r) => <Badge tone={r.id === selectedId ? 'accent' : 'neutral'}>{versionLabel(r.version)}</Badge>,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      width: 140,
      render: (r) => <span className="ss-muted">{relativeTime(r.updatedAt, now)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: 120,
      sortable: false,
      // Version history and export arrive with their screens (roadmap 5.2 and 4.4).
      render: (r) => (
        // A double click on a button is not a double click on the row.
        <div className="ss-table-actions" onDoubleClick={(e) => e.stopPropagation()}>
          <IconButton icon="history" label="Version history" size="sm" disabled />
          <IconButton icon="download" label="Export" size="sm" disabled />
          <IconButton
            icon="more"
            label="More"
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

  return (
    <div className="ss-page" ref={page}>
      <div className="ss-page-head">
        <div className="ss-page-title">Schemas</div>
        <span className="ss-page-count">{`${rows.length} of ${schemas.length}`}</span>
        <span className="ss-spacer" />
        {/* Import arrives with its dialog (roadmap 4.2). */}
        <Button icon="upload" kbd={['⌘', 'I']} disabled>
          Import
        </Button>
        <Button variant="primary" icon="plus" kbd={['⌘', 'N']} onClick={requestNewSchema}>
          New Schema
        </Button>
      </div>
      <div className="ss-page-tools">
        <div style={{ width: 320 }}>
          <Input
            icon="search"
            placeholder="Search schemas…"
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
            aria-label="Search schemas"
          />
        </div>
        <SegmentedControl value={engine} onChange={setEngine} options={ENGINE_OPTIONS} />
        <span className="ss-spacer" />
        <span className="ss-faint" style={{ fontSize: 12 }}>
          Sort
        </span>
        <div style={{ width: 150 }}>
          <Select
            size="sm"
            label="Sort"
            value={sort.key}
            onChange={(key) => setSort({ key: key as SchemaSortKey, dir: initialSortDirection(key as SchemaSortKey) })}
            options={
              // A header can sort by a column the menu does not list.
              SORT_OPTIONS.some((o) => o.value === sort.key)
                ? SORT_OPTIONS
                : [...SORT_OPTIONS, { value: sort.key, label: sort.key === 'engine' ? 'Database' : 'Relations' }]
            }
          />
        </div>
      </div>
      <div className="ss-page-body">
        <DataTable
          rowKey="id"
          selectedKey={selectedId}
          onRowClick={(r) => setSelectedId(r.id)}
          onRowDoubleClick={(r) => openSchema(r.id)}
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
            No schemas match the search and filter.
          </div>
        )}
        <div className="ss-row ss-faint" style={{ fontSize: 12, padding: '14px 12px' }}>
          <Icon name="folder" size={14} />
          Stored locally in this browser
          <span className="ss-spacer" />
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          {' to move · '}
          <Kbd>⏎</Kbd>
          {' to open'}
        </div>
      </div>
      {menuFor && menu && (
        <div style={{ position: 'fixed', left: menu.left, top: menu.top, zIndex: 20 }}>
          <ContextMenu
            label={menuFor.name}
            onClose={() => setMenu(null)}
            items={[
              { icon: 'external', label: 'Open', shortcut: '⏎', onSelect: () => openSchema(menuFor.id) },
              '-',
              {
                icon: 'trash',
                label: 'Delete schema',
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
