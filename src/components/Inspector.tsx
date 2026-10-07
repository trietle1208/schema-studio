import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { addColumn, removeColumn, setColumn, setNullable, setPrimaryKey } from '../core/columns';
import type { Column, Table } from '../core/model';
import { incomingRelations, outgoingRelations, qualifiedName } from '../core/relations';
import { validateColumns, validateTableName } from '../core/validate';
import { Badge } from './Badge';
import { Button } from './Button';
import { ColumnEditor } from './ColumnEditor';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Kbd } from './Kbd';
import { Select } from './Select';
import { TypeSelect } from './TypeSelect';

const DEFAULT_SCHEMA = 'public';

export interface InspectorProps {
  table: Table | null;
  tables?: Table[];
  selectedColumn?: number | null;
  onSelectColumn?: (index: number | null) => void;
  /** `field` names a text field being typed into, so the caller can treat the keystrokes as one edit. */
  onChange: (table: Table, field?: string) => void;
  onRename?: (from: string, to: string) => void;
  onDuplicate?: (name: string) => void;
  onDelete?: (name: string) => void;
  /** Adding indexes and foreign keys has no editor yet; the buttons stay disabled without a handler. */
  onAddIndex?: (name: string) => void;
  onAddForeignKey?: (name: string) => void;
  /** A "New table" button for when no table is selected. */
  onNewTable?: () => void;
  typeMenuOpen?: boolean;
  renaming?: boolean;
  /** Each change puts the table title into rename mode (F2). */
  renameSignal?: number;
  autoFocusDraft?: boolean;
  settingsCollapsed?: boolean;
  schemaName?: string;
}

interface InspectorSectionProps {
  title: string;
  count?: number;
  collapsed?: boolean;
  /** Shows the add button in the header; it is disabled without `onAdd`. */
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
}

function InspectorSection({ title, count, collapsed: initiallyCollapsed, addLabel, onAdd, children }: InspectorSectionProps) {
  const [collapsed, setCollapsed] = useState(!!initiallyCollapsed);
  return (
    <section className={cx('ss-insp-sec', collapsed && 'is-collapsed')}>
      <div className="ss-insp-sec-head" onClick={() => setCollapsed(!collapsed)} role="button" aria-expanded={!collapsed}>
        <Icon name="chevron-down" size={14} />
        <span className="ss-caption" style={{ color: 'var(--ink-2)' }}>
          {title}
        </span>
        {count != null && <span className="ss-insp-sec-count">{count}</span>}
        <span className="ss-spacer" />
        {addLabel && (
          <IconButton
            icon="plus"
            size="sm"
            label={addLabel}
            disabled={!onAdd}
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
          />
        )}
      </div>
      <div className="ss-insp-sec-body">{children}</div>
    </section>
  );
}

interface TableTitleProps {
  table: Table;
  tables: Table[];
  renaming?: boolean;
  renameSignal?: number;
  onRename?: (from: string, to: string) => void;
  onDuplicate?: (name: string) => void;
  onDelete?: (name: string) => void;
}

// Keyed by table name, so an unfinished rename never carries over to another table.
function TableTitle({
  table: t,
  tables,
  renaming: initiallyRenaming,
  renameSignal,
  onRename,
  onDuplicate,
  onDelete,
}: TableTitleProps) {
  /** The name being typed, or null when the title is not being renamed. */
  const [draft, setDraft] = useState<string | null>(initiallyRenaming ? t.name : null);
  const [seenSignal, setSeenSignal] = useState(renameSignal);
  if (renameSignal !== seenSignal) {
    setSeenSignal(renameSignal);
    if (draft === null) setDraft(t.name);
  }
  const name = draft?.trim() ?? t.name;
  const error =
    draft === null
      ? null
      : validateTableName(
          name,
          tables.filter((o) => o.name !== t.name).map((o) => o.name),
        );

  function commit() {
    if (draft === null || error) return;
    setDraft(null);
    if (name !== t.name) onRename?.(t.name, name);
  }

  return (
    <>
      <div className="ss-insp-title">
        <Icon name="table" size={16} />
        {draft !== null ? (
          <input
            className={cx('ss-insp-name', error && 'is-error')}
            autoFocus={!initiallyRenaming}
            value={draft}
            spellCheck={false}
            data-local-edit
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) commit();
              if (e.key === 'Escape') setDraft(null);
            }}
            aria-label="Table name"
            aria-invalid={!!error}
          />
        ) : (
          <button type="button" className="ss-insp-name" onClick={() => setDraft(t.name)} title="Rename (F2)">
            {t.name}
          </button>
        )}
        <IconButton icon="pencil" label="Rename (F2)" onClick={() => setDraft(t.name)} />
        <IconButton icon="copy" label="Duplicate (⌘D)" disabled={!onDuplicate} onClick={() => onDuplicate?.(t.name)} />
        <IconButton icon="trash" label="Delete (⌫)" disabled={!onDelete} onClick={() => onDelete?.(t.name)} />
      </div>
      {error && (
        <div className="ss-field-error" role="alert">
          <Icon name="alert" size={13} />
          {error}
        </div>
      )}
    </>
  );
}

export function Inspector({
  table: t,
  tables = [],
  selectedColumn,
  onSelectColumn,
  onChange,
  onRename,
  onDuplicate,
  onDelete,
  onAddIndex,
  onAddForeignKey,
  onNewTable,
  typeMenuOpen,
  renaming,
  renameSignal,
  autoFocusDraft,
  settingsCollapsed,
  schemaName,
}: InspectorProps) {
  /** The last table sent to `onChange` since the previous render, and the `table` it was built from. */
  const sent = useRef<{ from: Table; to: Table } | null>(null);
  useEffect(() => {
    sent.current = null;
  });

  if (!t) {
    return (
      <aside className="ss-inspector">
        <div className="ss-insp-head">
          <div className="ss-insp-title">
            <Icon name="database" size={16} />
            <span className="ss-insp-name" style={{ cursor: 'default' }}>
              {schemaName}
            </span>
          </div>
        </div>
        <div className="ss-insp-empty" style={{ padding: 16 }}>
          {'Select a table to edit its columns, indexes and foreign keys. '}
          <br />
          <br />
          <span className="ss-row">
            <Kbd keys={['⌘', 'K']} />
            Jump to table
          </span>
          {onNewTable && (
            <>
              <br />
              <Button size="sm" icon="plus" onClick={onNewTable}>
                New table
              </Button>
            </>
          )}
        </div>
      </aside>
    );
  }

  const errors = validateColumns(t);
  const indexes = t.indexes ?? [];
  const outgoing = outgoingRelations(t);
  const incoming = incomingRelations(t, tables);
  const relationCount = outgoing.length + incoming.length;
  const schema = t.schema || DEFAULT_SCHEMA;
  const schemas = [...new Set([DEFAULT_SCHEMA, schema, ...tables.map((o) => o.schema || DEFAULT_SCHEMA)])];

  // Two edits in one event (a type committed by ⌘⏎, then the column it adds) must build on each
  // other, but `t` only changes on the next render: later edits start from the table already sent.
  function edit(apply: (table: Table) => Table, field?: string): Table | null {
    if (!t) return null;
    const base = sent.current?.from === t ? sent.current.to : t;
    const next = apply(base);
    if (next === base) return base;
    sent.current = { from: t, to: next };
    onChange(next, field);
    return next;
  }

  function setCol(i: number, column: Column, field?: string) {
    edit((table) => setColumn(table, i, column), field && `columns.${i}.${field}`);
  }

  function deleteCol(i: number) {
    edit((table) => removeColumn(table, i));
    onSelectColumn?.(null);
  }

  function addCol() {
    const next = edit((table) => addColumn(table));
    if (next) onSelectColumn?.(next.columns.length - 1);
  }

  return (
    <aside
      className="ss-inspector"
      aria-label="Inspector"
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        addCol();
      }}
    >
      <div className="ss-insp-head">
        <TableTitle
          key={t.name}
          table={t}
          tables={tables}
          renaming={renaming}
          renameSignal={renameSignal}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
        <div className="ss-insp-meta">
          <span>{schema}</span>
          {'·'}
          <span>{`${t.columns.length} columns`}</span>
          {'·'}
          <span>{`${indexes.length} indexes`}</span>
          {'·'}
          <span>{`${relationCount} relations`}</span>
        </div>
      </div>
      <div className="ss-insp-body">
        <InspectorSection title="Columns" count={t.columns.length} onAdd={addCol} addLabel="Add column (⌘⏎)">
          <div className="ss-col-head">
            <span />
            <span>Name</span>
            <span>Type</span>
            <span title="Not null">NN</span>
            <span title="Primary key">PK</span>
            <span title="Unique">UQ</span>
          </div>
          {t.columns.map((c, i) => {
            const selected = selectedColumn === i;
            const err = errors[i];
            return (
              <Fragment key={i}>
                <div
                  className={cx('ss-colrow', selected && 'is-selected', !!err && 'is-invalid')}
                  onClick={() => onSelectColumn?.(selected ? null : i)}
                >
                  <Icon name="grip" size={14} className="ss-colrow-grip" />
                  <input
                    className={cx('ss-cell-input', !!err && 'is-error')}
                    value={c.name}
                    placeholder="column_name"
                    spellCheck={false}
                    aria-label="Column name"
                    aria-invalid={!!err}
                    autoFocus={!!(c.draft && selected && autoFocusDraft)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selected) onSelectColumn?.(i);
                    }}
                    onChange={(e) => setCol(i, { ...c, name: e.target.value }, 'name')}
                  />
                  {selected ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <TypeSelect
                        value={c.type}
                        size="sm"
                        placement="top"
                        align="end"
                        defaultOpen={typeMenuOpen && c.draft}
                        onChange={(type) => setCol(i, { ...c, type })}
                      />
                    </div>
                  ) : (
                    <span className="ss-cell-input ss-cell-type" style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                      {c.type}
                    </span>
                  )}
                  <button
                    type="button"
                    className={cx('ss-flag', !c.nullable && 'is-on')}
                    title={c.nullable ? 'Nullable — click for NOT NULL' : 'NOT NULL'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCol(i, setNullable(c, !c.nullable));
                    }}
                  >
                    NN
                  </button>
                  <button
                    type="button"
                    className={cx('ss-flag ss-flag--pk', c.pk && 'is-on')}
                    title="Primary key"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCol(i, setPrimaryKey(c, !c.pk));
                    }}
                  >
                    PK
                  </button>
                  <button
                    type="button"
                    className={cx('ss-flag', c.unique && 'is-on')}
                    title="Unique"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCol(i, { ...c, unique: !c.unique });
                    }}
                  >
                    UQ
                  </button>
                </div>
                {err && (
                  <div className="ss-colrow-error">
                    <div className="ss-field-error" role="alert">
                      <Icon name="alert" size={13} />
                      {err}
                    </div>
                  </div>
                )}
                {selected && (
                  <ColumnEditor
                    column={c}
                    table={t}
                    tables={tables}
                    onChange={(column, field) => setCol(i, column, field)}
                    onDelete={() => deleteCol(i)}
                  />
                )}
              </Fragment>
            );
          })}
          <div className="ss-insp-add">
            <Button variant="ghost" size="sm" icon="plus" onClick={addCol} kbd={['⌘', '⏎']}>
              Add column
            </Button>
          </div>
        </InspectorSection>
        <InspectorSection
          title="Indexes"
          count={indexes.length}
          addLabel="Add index"
          onAdd={onAddIndex && (() => onAddIndex(t.name))}
        >
          {indexes.map((ix) => (
            <div key={ix.name} className="ss-insp-item">
              <Icon
                name={ix.type === 'PRIMARY KEY' ? 'key' : 'hash'}
                size={14}
                style={ix.type === 'PRIMARY KEY' ? { color: 'var(--pk)' } : undefined}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ix.name}</span>
              {ix.type !== 'INDEX' ? <Badge>{ix.type === 'PRIMARY KEY' ? 'PK' : 'UNIQUE'}</Badge> : <span />}
              <span className="ss-insp-item-sub">{`${ix.using} (${ix.columns.join(', ')})`}</span>
            </div>
          ))}
          <div className="ss-insp-add">
            <Button variant="ghost" size="sm" icon="plus" disabled={!onAddIndex} onClick={() => onAddIndex?.(t.name)}>
              Add index
            </Button>
          </div>
        </InspectorSection>
        <InspectorSection
          title="Foreign keys"
          count={relationCount}
          addLabel="Add foreign key"
          onAdd={onAddForeignKey && (() => onAddForeignKey(t.name))}
        >
          {relationCount === 0 && <div className="ss-insp-empty">No relationships yet.</div>}
          {outgoing.map((r) => (
            <div key={`o${qualifiedName(r.from)}`} className="ss-insp-item">
              <Icon name="arrow-right" size={14} style={{ color: 'var(--fk)' }} />
              <span>
                {qualifiedName(r.from)}
                <span className="ss-faint">{' → '}</span>
                {qualifiedName(r.to)}
              </span>
              <Badge>{r.onDelete}</Badge>
              <span className="ss-insp-item-sub">{`outgoing · ON DELETE ${r.onDelete}`}</span>
            </div>
          ))}
          {incoming.map((r) => (
            <div key={`i${qualifiedName(r.from)}`} className="ss-insp-item">
              <Icon name="link" size={14} style={{ color: 'var(--fk)' }} />
              <span>
                {qualifiedName(r.from)}
                <span className="ss-faint">{' → '}</span>
                {qualifiedName(r.to)}
              </span>
              <Badge>{r.onDelete}</Badge>
              <span className="ss-insp-item-sub">{`incoming · referenced by ${r.from.table}`}</span>
            </div>
          ))}
          <div className="ss-insp-add">
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              disabled={!onAddForeignKey}
              onClick={() => onAddForeignKey?.(t.name)}
            >
              Add foreign key
            </Button>
          </div>
        </InspectorSection>
        <InspectorSection title="Table settings" collapsed={settingsCollapsed}>
          <div className="ss-insp-kv">
            <label>Comment</label>
            <textarea
              className="ss-input"
              rows={2}
              value={t.comment || ''}
              placeholder="What does a row represent?"
              onChange={(e) => edit((table) => ({ ...table, comment: e.target.value }), 'comment')}
            />
            <label>Schema</label>
            <Select size="sm" mono value={schema} options={schemas} onChange={(v) => edit((table) => ({ ...table, schema: v }))} />
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}
