import { useState } from 'react';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import {
  assignGroup,
  GROUP_COLORS,
  groupChoices,
  groupNameProblem,
  newGroupName,
  recolorGroup,
  removeGroup,
  renameGroup,
  suggestGroups,
} from '../core/groups';
import { t } from '../core/i18n';
import type { GroupColor, Table, TableGroup } from '../core/model';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

interface TablePickerProps {
  group: TableGroup;
  groups: readonly TableGroup[];
  tables: readonly Table[];
  /** The tables are to be in the group, or in none. */
  onPick: (tables: readonly string[], member: boolean) => void;
}

/**
 * The tables of the schema, each to be ticked into the group or out of it, and a filter that
 * leaves the ones of a name, which the button beside it takes at once. A table of another group
 * says which, and a tick moves it.
 */
function TablePicker({ group, groups, tables, onPick }: TablePickerProps) {
  const [filter, setFilter] = useState('');
  const choices = groupChoices(tables, groups, group.name, filter);
  // What the button beside the filter takes: the tables shown that are in no group, and once
  // there are none, the ones that are in this one. A table of another group is moved by its tick.
  const free = choices.filter((c) => !c.member && !c.from).map((c) => c.table);
  const own = choices.filter((c) => c.member).map((c) => c.table);

  return (
    <div className="ss-groups-pick">
      <div className="ss-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            size="sm"
            mono
            icon="search"
            placeholder={t('groups.filter')}
            aria-label={t('groups.filterLabel', { name: group.name })}
            spellCheck={false}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={!free.length && !own.length}
          title={free.length || !own.length ? t('groups.addShownTitle') : t('groups.removeShownTitle')}
          onClick={() => (free.length ? onPick(free, true) : onPick(own, false))}
        >
          {free.length || !own.length ? t('groups.addShown', { count: free.length }) : t('groups.removeShown', { count: own.length })}
        </Button>
      </div>
      {choices.length === 0 ? (
        <div className="ss-insp-empty" style={{ padding: '6px 0 0' }}>
          {tables.length ? t('groups.noMatch') : t('groups.noTables')}
        </div>
      ) : (
        <div className="ss-groups-pick-list" role="group" aria-label={t('groups.tablesOf', { name: group.name })}>
          {choices.map((c) => (
            <Checkbox
              key={c.table}
              className="ss-groups-pick-row"
              checked={c.member}
              onChange={(member) => onPick([c.table], member)}
              label={
                <>
                  <span className="ss-groups-pick-name">{c.table}</span>
                  {c.from && (
                    <span className={cx('ss-groups-pick-from', `ss-group--${c.from.color}`)} title={t('groups.inGroup', { name: c.from.name })}>
                      <span className="ss-group-swatch" />
                      {c.from.name}
                    </span>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GroupRowProps {
  group: TableGroup;
  groups: readonly TableGroup[];
  tables: readonly Table[];
  /** The tables of the schema are listed under the group, to be chosen. */
  picking: boolean;
  onPicking: (picking: boolean) => void;
  onPick: (tables: readonly string[], member: boolean) => void;
  /** The label is being typed into as soon as the row shows, as for a group that was just made. */
  autoFocus?: boolean;
  onRename: (to: string) => void;
  onRecolor: (color: GroupColor) => void;
  onRemove: () => void;
}

/**
 * A group: its label, which is typed over and kept on Enter or when the field is left, its colour
 * and its tables, which "Choose tables" lists to be chosen.
 */
function GroupRow({ group, groups, tables, picking, autoFocus, onPicking, onPick, onRename, onRecolor, onRemove }: GroupRowProps) {
  const [draft, setDraft] = useState(group.name);
  // The row stays when its group is called something else, so that the press that left the label
  // lands on what it was for. The label then starts over from the name.
  const [named, setNamed] = useState(group.name);
  if (named !== group.name) {
    setNamed(group.name);
    setDraft(group.name);
  }
  const problem = draft === group.name ? null : groupNameProblem(groups, draft, group.name);

  return (
    <div className={cx('ss-groups-row', `ss-group--${group.color}`)} role="listitem">
      <span className="ss-groups-name">
        <span className="ss-group-swatch" />
        <input
          className={cx('ss-cell-input', !!problem && 'is-error')}
          style={{ flex: 1, minWidth: 0 }}
          value={draft}
          spellCheck={false}
          aria-label={t('groups.name')}
          aria-invalid={!!problem}
          autoFocus={autoFocus}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          // A name the group cannot have is given up for the one it has.
          onBlur={() => (problem ? setDraft(group.name) : onRename(draft))}
        />
      </span>
      <span className="ss-row">
        <Button size="sm" icon="table" active={picking} aria-expanded={picking} onClick={() => onPicking(!picking)}>
          {t('groups.choose')}
        </Button>
        <span className="ss-groups-colors" role="radiogroup" aria-label={t('groups.colourOf', { name: group.name })}>
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === group.color}
              aria-label={t(`color.${color}`)}
              title={t(`color.${color}`)}
              className={cx('ss-groups-color', `ss-group--${color}`)}
              onClick={() => onRecolor(color)}
            >
              <span className="ss-group-swatch" />
            </button>
          ))}
        </span>
        <IconButton icon="trash" size="sm" label={t('groups.remove', { name: group.name })} onClick={onRemove} />
      </span>
      {problem && (
        <div className="ss-field-error" role="alert">
          <Icon name="alert" size={13} />
          {problem}
        </div>
      )}
      <span className="ss-groups-tables" title={group.tables.join(', ')}>
        {group.tables.length
          ? `${t('count.tables', { count: group.tables.length })} · ${group.tables.join(', ')}`
          : t('groups.empty')}
      </span>
      {picking && <TablePicker group={group} groups={groups} tables={tables} onPick={onPick} />}
    </div>
  );
}

/**
 * The groups of tables of the open schema, each with its label, its colour and its tables to
 * change, and under them the groups the names of the tables point to, each to be added. A change
 * takes effect at once and is one undo step.
 */
export function TableGroupsDialog() {
  const tables = useSchemaStore((s) => s.tables);
  const groups = useSchemaStore((s) => s.groups);
  const editGroups = useSchemaStore((s) => s.editGroups);
  const closeDialog = useUiStore((s) => s.closeDialog);
  /** The group "New group" has made, whose label is to be typed. */
  const [made, setMade] = useState<string | null>(null);
  /** The group whose tables are being chosen: one at a time. */
  const [picking, setPicking] = useState<string | null>(null);

  const suggestions = suggestGroups(tables, groups);
  const grouped = groups.reduce((sum, g) => sum + g.tables.length, 0);

  return (
    <Modal
      title={t('action.tableGroups')}
      subtitle={
        groups.length
          ? t('groups.subtitle', {
              groups: t('count.groups', { count: groups.length }),
              grouped,
              tables: t('count.tables', { count: tables.length }),
            })
          : t('groups.subtitleNone')
      }
      icon="folder"
      width={600}
      onClose={closeDialog}
      bodyStyle={{ padding: 0 }}
      footerStart={
        <Button
          icon="plus"
          onClick={() => {
            const name = newGroupName(groups);
            if (!editGroups((g) => assignGroup(g, [], name))) return;
            setMade(name);
            // It has no tables yet: they are the next thing to choose.
            setPicking(name);
          }}
        >
          {t('groups.new')}
        </Button>
      }
      footer={
        <>
          <Button
            icon="check"
            disabled={!suggestions.length}
            onClick={() => editGroups((g) => suggestions.reduce((all, s) => assignGroup(all, s.tables, s.name), g))}
          >
            {t('groups.addAll')}
          </Button>
          <Button variant="primary" onClick={closeDialog} kbd="Esc" data-autofocus>
            {t('common.done')}
          </Button>
        </>
      }
    >
      {groups.length > 0 && (
        <div role="list" aria-label={t('groups.list')}>
          {groups.map((group, i) => (
            <GroupRow
              key={i}
              group={group}
              groups={groups}
              tables={tables}
              picking={group.name === picking}
              autoFocus={group.name === made}
              onPicking={(on) => setPicking(on ? group.name : null)}
              onPick={(names, member) => editGroups((g) => assignGroup(g, names, member ? group.name : null))}
              onRename={(to) => {
                if (editGroups((g) => renameGroup(g, group.name, to)) && picking === group.name) setPicking(to.trim());
              }}
              onRecolor={(color) => editGroups((g) => recolorGroup(g, group.name, color))}
              onRemove={() => editGroups((g) => removeGroup(g, group.name))}
            />
          ))}
        </div>
      )}
      <div className="ss-groups-head ss-caption">{t('groups.suggestedHead')}</div>
      {suggestions.length === 0 && (
        <div className="ss-insp-empty" style={{ padding: '8px 16px 16px' }}>
          {groups.length
            ? t('groups.nothingMore')
            : t('groups.nothing')}
        </div>
      )}
      {suggestions.length > 0 && (
        <div role="list" aria-label={t('groups.suggested')}>
          {suggestions.map((s) => {
            const adds = groups.some((g) => g.name === s.name);
            return (
              <div key={s.name} className="ss-groups-row" role="listitem">
                <span className="ss-groups-name">{s.name}</span>
                <Button size="sm" icon="plus" onClick={() => editGroups((g) => assignGroup(g, s.tables, s.name))}>
                  {adds ? t('groups.addTo') : t('groups.add')}
                </Button>
                <span className="ss-groups-tables" title={s.tables.join(', ')}>
                  {`${t('count.tables', { count: s.tables.length })} · ${s.tables.join(', ')}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
