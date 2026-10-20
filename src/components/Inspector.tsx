import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { addColumn, removeColumn, setColumn, setNullable, setPrimaryKey } from '../core/columns';
import { groupOf } from '../core/groups';
import { t } from '../core/i18n';
import type { Column, Table, TableGroup } from '../core/model';
import { incomingRelations, outgoingRelations, qualifiedName } from '../core/relations';
import { validateColumns, validateTableName } from '../core/validate';
import { Badge } from './Badge';
import { Button } from './Button';
import { ColumnEditor } from './ColumnEditor';
import { cx } from './cx';
import { Field } from './Field';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Kbd } from './Kbd';
import { Select } from './Select';
import { TypeSelect } from './TypeSelect';

const DEFAULT_SCHEMA = 'public';
// What the Group field holds besides the name of a group, which is never empty.
const NO_GROUP = '';
const NEW_GROUP = '\0new';
const SEVERAL_GROUPS = '\0several';

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
  /** Adding indexes has no editor yet; the buttons of either stay disabled without a handler. */
  onAddIndex?: (name: string) => void;
  onAddForeignKey?: (name: string) => void;
  /** A "New table" button for when no table is selected. */
  onNewTable?: () => void;
  /** "Infer relationships" under the hint of a schema with no table selected. Without it the button is not there. */
  onInferRelations?: () => void;
  /** "Review inferred" next to it. Left out when there are none to review. */
  onReviewInferred?: () => void;
  /** "Remove inferred" next to them. Left out when there are none to remove. */
  onRemoveInferred?: () => void;
  /** How many tables are selected when `table` is null because several are: the hint then says what can be done with them. */
  selectedCount?: number;
  /** The tables that are selected when several are: the Group field is then for all of them. */
  selection?: readonly string[];
  /** The groups of tables of the schema. */
  groups?: readonly TableGroup[];
  /** The Group field: the tables are to be in the group called `group`, or in none with null. Without it there is no such field. */
  onGroup?: (tables: readonly string[], group: string | null) => void;
  /** "New group…" in the Group field: the tables are to be a group of their own. */
  onNewGroup?: (tables: readonly string[]) => void;
  /** "Table groups" under the hint of a schema with no table selected. Without it the button is not there. */
  onGroups?: () => void;
  typeMenuOpen?: boolean;
  renaming?: boolean;
  /** Each change puts the table title into rename mode (F2). */
  renameSignal?: number;
  autoFocusDraft?: boolean;
  settingsCollapsed?: boolean;
  schemaName?: string;
  /** The database engine of the schema, whose types the type picker offers. */
  engine?: string;
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

interface GroupFieldProps {
  groups: readonly TableGroup[];
  /** The tables the field is for. */
  tables: readonly string[];
  onGroup: (tables: readonly string[], group: string | null) => void;
  onNewGroup?: (tables: readonly string[]) => void;
  label?: string;
}

/** The group of a table, or of several when they are all in one, to be changed for another, for none or for a new one. */
function GroupField({ groups, tables, onGroup, onNewGroup, label }: GroupFieldProps) {
  const own = [...new Set(tables.map((table) => groupOf(groups, table)))];
  const value = own.length === 1 ? (own[0]?.name ?? NO_GROUP) : SEVERAL_GROUPS;
  return (
    <span className={cx('ss-row', own.length === 1 && own[0] && `ss-group--${own[0].color}`)} style={{ minWidth: 0 }}>
      {own.length === 1 && own[0] && <span className="ss-group-swatch" />}
      <Select
        size="sm"
        mono
        label={label ?? t('inspector.group')}
        style={{ flex: 1, minWidth: 0 }}
        value={value}
        options={[
          ...(value === SEVERAL_GROUPS ? [{ value: SEVERAL_GROUPS, label: t('inspector.severalGroups'), disabled: true }] : []),
          { value: NO_GROUP, label: t('common.none') },
          ...groups.map((g) => ({ value: g.name, label: g.name })),
          ...(onNewGroup ? [{ value: NEW_GROUP, label: t('inspector.newGroup') }] : []),
        ]}
        onChange={(v) => (v === NEW_GROUP ? onNewGroup?.(tables) : onGroup(tables, v === NO_GROUP ? null : v))}
      />
    </span>
  );
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
  table,
  tables,
  renaming: initiallyRenaming,
  renameSignal,
  onRename,
  onDuplicate,
  onDelete,
}: TableTitleProps) {
  /** The name being typed, or null when the title is not being renamed. */
  const [draft, setDraft] = useState<string | null>(initiallyRenaming ? table.name : null);
  const [seenSignal, setSeenSignal] = useState(renameSignal);
  if (renameSignal !== seenSignal) {
    setSeenSignal(renameSignal);
    if (draft === null) setDraft(table.name);
  }
  const name = draft?.trim() ?? table.name;
  const error =
    draft === null
      ? null
      : validateTableName(
          name,
          tables.filter((o) => o.name !== table.name).map((o) => o.name),
        );

  function commit() {
    if (draft === null || error) return;
    setDraft(null);
    if (name !== table.name) onRename?.(table.name, name);
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
            aria-label={t('inspector.tableName')}
            aria-invalid={!!error}
          />
        ) : (
          <button type="button" className="ss-insp-name" onClick={() => setDraft(table.name)} title={t('inspector.rename')}>
            {table.name}
          </button>
        )}
        <span className="ss-insp-title-actions">
          <IconButton icon="pencil" label={t('inspector.rename')} onClick={() => setDraft(table.name)} />
          <IconButton icon="copy" label={t('inspector.duplicate')} disabled={!onDuplicate} onClick={() => onDuplicate?.(table.name)} />
          <IconButton icon="trash" label={t('inspector.delete')} disabled={!onDelete} onClick={() => onDelete?.(table.name)} />
        </span>
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

function EmptyInspector({
  schemaName,
  selectedCount,
  selection,
  groups,
  onGroup,
  onNewGroup,
  onNewTable,
  onInferRelations,
  onReviewInferred,
  onRemoveInferred,
  onGroups,
}: {
  schemaName?: string;
  selectedCount?: number;
  selection?: readonly string[];
  groups: readonly TableGroup[];
  onGroup?: (tables: readonly string[], group: string | null) => void;
  onNewGroup?: (tables: readonly string[]) => void;
  onNewTable?: () => void;
  onInferRelations?: () => void;
  onReviewInferred?: () => void;
  onRemoveInferred?: () => void;
  onGroups?: () => void;
}) {
  const several = selectedCount !== undefined && selectedCount > 1;
  const hasInfer = !!(onInferRelations || onReviewInferred || onRemoveInferred);

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
      <div className="ss-insp-empty">
        <div className="ss-insp-empty-top">
          <p className="ss-insp-lead">{several ? t('inspector.selected', { count: selectedCount }) : t('inspector.empty')}</p>
          {onNewTable && (
            <Button variant="primary" size="sm" icon="plus" className="ss-insp-cta" onClick={onNewTable}>
              {t('action.newTable')}
            </Button>
          )}
        </div>

        <div className="ss-insp-hints" role="list">
          {several ? (
            <div className="ss-insp-hint" role="listitem">
              <Kbd keys={['⇧', 'A']} />
              <span>{t('action.arrangeSelected')}</span>
            </div>
          ) : (
            <>
              <div className="ss-insp-hint" role="listitem">
                <Kbd keys={['⌘', 'K']} />
                <span>{t('inspector.jump')}</span>
              </div>
              <div className="ss-insp-hint" role="listitem">
                <Kbd keys={['⇧']} />
                <span>{t('inspector.selectSeveral')}</span>
              </div>
            </>
          )}
        </div>

        {several && selection && onGroup && (
          <section className="ss-insp-card">
            <Field label={t('inspector.group')}>
              <GroupField groups={groups} tables={selection} onGroup={onGroup} onNewGroup={onNewGroup} />
            </Field>
          </section>
        )}

        {hasInfer && (
          <section className="ss-insp-card">
            <div className="ss-insp-card-head">
              <Icon name="link" size={14} />
              <span className="ss-caption">{t('inspector.inferTitle')}</span>
            </div>
            <p className="ss-insp-card-text">{t('inspector.inferHint')}</p>
            <div className="ss-insp-stack">
              {onInferRelations && (
                <Button size="sm" icon="link" onClick={onInferRelations}>
                  {t('action.inferRelationships')}
                </Button>
              )}
              {onReviewInferred && (
                <Button size="sm" icon="check" onClick={onReviewInferred}>
                  {t('inspector.reviewInferred')}
                </Button>
              )}
              {onRemoveInferred && (
                <Button size="sm" variant="ghost" icon="x" onClick={onRemoveInferred}>
                  {t('inspector.removeInferred')}
                </Button>
              )}
            </div>
          </section>
        )}

        {onGroups && (
          <section className="ss-insp-card">
            <div className="ss-insp-card-head">
              <Icon name="folder" size={14} />
              <span className="ss-caption">{t('inspector.groupsTitle')}</span>
            </div>
            <p className="ss-insp-card-text">{t('inspector.groupsHint')}</p>
            <div className="ss-insp-stack">
              <Button size="sm" icon="folder" onClick={onGroups}>
                {t('action.tableGroups')}
              </Button>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

export function Inspector({
  table,
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
  onInferRelations,
  onReviewInferred,
  onRemoveInferred,
  selectedCount,
  selection,
  groups = [],
  onGroup,
  onNewGroup,
  onGroups,
  typeMenuOpen,
  renaming,
  renameSignal,
  autoFocusDraft,
  settingsCollapsed,
  schemaName,
  engine,
}: InspectorProps) {
  /** The last table sent to `onChange` since the previous render, and the `table` it was built from. */
  const sent = useRef<{ from: Table; to: Table } | null>(null);
  useEffect(() => {
    sent.current = null;
  });

  if (!table) {
    return (
      <EmptyInspector
        schemaName={schemaName}
        selectedCount={selectedCount}
        selection={selection}
        groups={groups}
        onGroup={onGroup}
        onNewGroup={onNewGroup}
        onNewTable={onNewTable}
        onInferRelations={onInferRelations}
        onReviewInferred={onReviewInferred}
        onRemoveInferred={onRemoveInferred}
        onGroups={onGroups}
      />
    );
  }

  const errors = validateColumns(table);
  const indexes = table.indexes ?? [];
  const outgoing = outgoingRelations(table);
  const incoming = incomingRelations(table, tables);
  const relationCount = outgoing.length + incoming.length;
  const schema = table.schema || DEFAULT_SCHEMA;
  const schemas = [...new Set([DEFAULT_SCHEMA, schema, ...tables.map((o) => o.schema || DEFAULT_SCHEMA)])];
  const group = groupOf(groups, table.name);

  // Two edits in one event (a type committed by ⌘⏎, then the column it adds) must build on each
  // other, but `table` only changes on the next render: later edits start from the table already sent.
  function edit(apply: (table: Table) => Table, field?: string): Table | null {
    if (!table) return null;
    const base = sent.current?.from === table ? sent.current.to : table;
    const next = apply(base);
    if (next === base) return base;
    sent.current = { from: table, to: next };
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

  const meta = [
    schema,
    t('count.columns', { count: table.columns.length }),
    t('count.indexes', { count: indexes.length }),
    t('count.relations', { count: relationCount }),
  ];

  return (
    <aside
      className="ss-inspector"
      aria-label={t('inspector.label')}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        addCol();
      }}
    >
      <div className="ss-insp-head">
        <TableTitle
          key={table.name}
          table={table}
          tables={tables}
          renaming={renaming}
          renameSignal={renameSignal}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
        <div className="ss-insp-meta">
          {meta.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden>·</span>}
              <span>{part}</span>
            </Fragment>
          ))}
          {group && (
            <>
              <span aria-hidden>·</span>
              <span className={cx('ss-row', `ss-group--${group.color}`)} style={{ gap: 4 }} title={t('group.title', { name: group.name })}>
                <span className="ss-group-swatch" />
                {group.name}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="ss-insp-body">
        <InspectorSection title={t('inspector.tableSettings')} collapsed={settingsCollapsed}>
          <div className="ss-insp-fields">
            <Field label={t('field.comment')}>
              <textarea
                className="ss-input"
                rows={2}
                value={table.comment || ''}
                placeholder={t('inspector.commentPlaceholder')}
                onChange={(e) => edit((table) => ({ ...table, comment: e.target.value }), 'comment')}
              />
            </Field>
            <div className="ss-insp-fields-row">
              <Field label={t('field.schema')}>
                <Select size="sm" mono value={schema} options={schemas} onChange={(v) => edit((table) => ({ ...table, schema: v }))} />
              </Field>
              {onGroup && (
                <Field label={t('inspector.group')}>
                  <GroupField groups={groups} tables={[table.name]} onGroup={onGroup} onNewGroup={onNewGroup} />
                </Field>
              )}
            </div>
          </div>
        </InspectorSection>

        <InspectorSection title={t('inspector.columns')} count={table.columns.length} onAdd={addCol} addLabel={`${t('action.addColumn')} (⌘⏎)`}>
          <div className="ss-col-head">
            <span />
            <span>{t('field.name')}</span>
            <span>{t('field.type')}</span>
            <span title={t('flag.notNull')}>NN</span>
            <span title={t('flag.primaryKey')}>PK</span>
            <span title={t('flag.unique')}>UQ</span>
          </div>
          {table.columns.map((c, i) => {
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
                    aria-label={t('field.columnName')}
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
                        engine={engine}
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
                    title={c.nullable ? t('inspector.nullableToggle') : 'NOT NULL'}
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
                    title={t('flag.primaryKey')}
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
                    title={t('flag.unique')}
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
                    table={table}
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
              {t('action.addColumn')}
            </Button>
          </div>
        </InspectorSection>

        <InspectorSection
          title={t('noun.indexes')}
          count={indexes.length}
          addLabel={t('inspector.addIndex')}
          onAdd={onAddIndex && (() => onAddIndex(table.name))}
        >
          {indexes.length === 0 ? (
            <div className="ss-insp-none">{t('inspector.noIndexes')}</div>
          ) : (
            indexes.map((ix) => (
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
            ))
          )}
          <div className="ss-insp-add">
            <Button variant="ghost" size="sm" icon="plus" disabled={!onAddIndex} onClick={() => onAddIndex?.(table.name)}>
              {t('inspector.addIndex')}
            </Button>
          </div>
        </InspectorSection>

        <InspectorSection
          title={t('inspector.foreignKeys')}
          count={relationCount}
          addLabel={t('action.addForeignKey')}
          onAdd={onAddForeignKey && (() => onAddForeignKey(table.name))}
        >
          {relationCount === 0 ? (
            <div className="ss-insp-none">{t('inspector.noRelationships')}</div>
          ) : (
            <>
              {outgoing.map((r) => (
                <div key={`o${qualifiedName(r.from)}`} className="ss-insp-item">
                  <Icon name="arrow-right" size={14} style={{ color: 'var(--fk)' }} />
                  <span>
                    {qualifiedName(r.from)}
                    <span className="ss-faint">{' → '}</span>
                    {qualifiedName(r.to)}
                  </span>
                  <Badge>{r.inferred ? t('relation.inferred') : r.onDelete}</Badge>
                  <span className="ss-insp-item-sub">
                    {t('inspector.outgoing', { detail: r.inferred ? t('inspector.inferredFromName') : `ON DELETE ${r.onDelete}` })}
                  </span>
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
                  <Badge>{r.inferred ? t('relation.inferred') : r.onDelete}</Badge>
                  <span className="ss-insp-item-sub">{t('inspector.incoming', { table: r.from.table })}</span>
                </div>
              ))}
            </>
          )}
          <div className="ss-insp-add">
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              disabled={!onAddForeignKey}
              onClick={() => onAddForeignKey?.(table.name)}
            >
              {t('action.addForeignKey')}
            </Button>
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}
