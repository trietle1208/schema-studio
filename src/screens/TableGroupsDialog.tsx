import { useState } from 'react';
import { Button } from '../components/Button';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { Modal } from '../components/Modal';
import {
  assignGroup,
  GROUP_COLORS,
  groupNameProblem,
  newGroupName,
  recolorGroup,
  removeGroup,
  renameGroup,
  suggestGroups,
} from '../core/groups';
import type { GroupColor, TableGroup } from '../core/model';
import { plural } from '../core/plural';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

interface GroupRowProps {
  group: TableGroup;
  groups: readonly TableGroup[];
  /** The label is being typed into as soon as the row shows, as for a group that was just made. */
  autoFocus?: boolean;
  onRename: (to: string) => void;
  onRecolor: (color: GroupColor) => void;
  onRemove: () => void;
}

/** A group: its label, which is typed over and kept on Enter or when the field is left, its colour and its tables. */
function GroupRow({ group, groups, autoFocus, onRename, onRecolor, onRemove }: GroupRowProps) {
  const [draft, setDraft] = useState(group.name);
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
          aria-label="Group name"
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
        <span className="ss-groups-colors" role="radiogroup" aria-label={`Colour of ${group.name}`}>
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === group.color}
              aria-label={color}
              title={color}
              className={cx('ss-groups-color', `ss-group--${color}`)}
              onClick={() => onRecolor(color)}
            >
              <span className="ss-group-swatch" />
            </button>
          ))}
        </span>
        <IconButton icon="trash" size="sm" label={`Remove group ${group.name}`} onClick={onRemove} />
      </span>
      {problem && (
        <div className="ss-field-error" role="alert">
          <Icon name="alert" size={13} />
          {problem}
        </div>
      )}
      <span className="ss-groups-tables" title={group.tables.join(', ')}>
        {group.tables.length
          ? `${plural(group.tables.length, 'table')} · ${group.tables.join(', ')}`
          : 'No tables. Put a table into it with the Group field of the inspector.'}
      </span>
    </div>
  );
}

/**
 * The groups of tables of the open schema, each with its label and colour to change, and under
 * them the groups the names of the tables point to, each to be added. A change takes effect at
 * once and is one undo step.
 */
export function TableGroupsDialog() {
  const tables = useSchemaStore((s) => s.tables);
  const groups = useSchemaStore((s) => s.groups);
  const editGroups = useSchemaStore((s) => s.editGroups);
  const closeDialog = useUiStore((s) => s.closeDialog);
  /** The group "New group" has made, whose label is to be typed. */
  const [made, setMade] = useState<string | null>(null);

  const suggestions = suggestGroups(tables, groups);
  const grouped = groups.reduce((sum, g) => sum + g.tables.length, 0);

  return (
    <Modal
      title="Table groups"
      subtitle={
        groups.length
          ? `${plural(groups.length, 'group')} · ${grouped} of ${plural(tables.length, 'table')} grouped. A group is of the diagram: exported SQL leaves it out.`
          : 'A group gives the tables of one module a colour and a label on the canvas. Exported SQL leaves it out.'
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
            if (editGroups((g) => assignGroup(g, [], name))) setMade(name);
          }}
        >
          New group
        </Button>
      }
      footer={
        <>
          <Button
            icon="check"
            disabled={!suggestions.length}
            onClick={() => editGroups((g) => suggestions.reduce((all, s) => assignGroup(all, s.tables, s.name), g))}
          >
            Add all suggested
          </Button>
          <Button variant="primary" onClick={closeDialog} kbd="Esc" data-autofocus>
            Done
          </Button>
        </>
      }
    >
      {groups.length > 0 && (
        <div role="list" aria-label="Groups">
          {groups.map((group) => (
            <GroupRow
              key={group.name}
              group={group}
              groups={groups}
              autoFocus={group.name === made}
              onRename={(to) => editGroups((g) => renameGroup(g, group.name, to))}
              onRecolor={(color) => editGroups((g) => recolorGroup(g, group.name, color))}
              onRemove={() => editGroups((g) => removeGroup(g, group.name))}
            />
          ))}
        </div>
      )}
      <div className="ss-groups-head ss-caption">Suggested from the names of the tables</div>
      {suggestions.length === 0 && (
        <div className="ss-insp-empty" style={{ padding: '8px 16px 16px' }}>
          {groups.length
            ? 'Nothing more to suggest: no two tables that are in no group begin with the same words.'
            : 'Nothing to suggest: no two tables begin with the same words.'}
        </div>
      )}
      {suggestions.length > 0 && (
        <div role="list" aria-label="Suggested groups">
          {suggestions.map((s) => {
            const adds = groups.some((g) => g.name === s.name);
            return (
              <div key={s.name} className="ss-groups-row" role="listitem">
                <span className="ss-groups-name">{s.name}</span>
                <Button size="sm" icon="plus" onClick={() => editGroups((g) => assignGroup(g, s.tables, s.name))}>
                  {adds ? 'Add to group' : 'Add group'}
                </Button>
                <span className="ss-groups-tables" title={s.tables.join(', ')}>
                  {`${plural(s.tables.length, 'table')} · ${s.tables.join(', ')}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
