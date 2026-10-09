import { Fragment } from 'react';
import { diffGroupLabel, diffKindLabel } from '../core/diff';
import { t, type MessageKey } from '../core/i18n';
import type { DiffGroup, DiffItem, DiffOp } from '../core/model';
import { cx } from './cx';

const OP_GLYPH: Record<DiffOp, string> = { add: '+', del: '−', mod: '~' };
const OP_WORD = { add: 'diff.op.add', del: 'diff.op.del', mod: 'diff.op.mod' } as const satisfies Record<DiffOp, MessageKey>;

export interface DiffRowProps {
  item: DiffItem;
  selected?: boolean;
  /** False hides the detail line. */
  showDetail?: boolean;
  /** What the item is, shown beside its path: `column`. */
  kind?: string | null;
  onClick?: () => void;
}

export function DiffRow({ item, selected, showDetail, kind, onClick }: DiffRowProps) {
  return (
    <div className={cx('ss-diff', item.op === 'del' && 'op-del-row', selected && 'is-selected')} onClick={onClick} title={t(OP_WORD[item.op])}>
      <span className={`ss-diff-op op-${item.op}`} aria-label={t(OP_WORD[item.op])}>
        {OP_GLYPH[item.op]}
      </span>
      <span className="ss-diff-path" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.path}
      </span>
      {kind && <span className="ss-diff-kind">{kind}</span>}
      {showDetail !== false && item.detail && <span className="ss-diff-detail">{item.detail}</span>}
    </div>
  );
}

export interface DiffListProps {
  groups: DiffGroup[];
  /** The `path` of the selected item. */
  selected?: string;
  onSelect?: (path: string, item: DiffItem) => void;
  /** False hides the heading of each group. */
  showGroups?: boolean;
  showDetail?: boolean;
  /** Names what each item is beside its path, for a list without group headings. */
  showKind?: boolean;
}

export function DiffList({ groups, selected, onSelect, showGroups, showDetail, showKind }: DiffListProps) {
  return (
    <div className="ss-difflist">
      {groups.map((g) => (
        <Fragment key={g.group}>
          {showGroups !== false && (
            <div className="ss-diff-group">
              <span className="ss-caption">{diffGroupLabel(g.group)}</span>
              <span className="ss-insp-sec-count">{g.items.length}</span>
            </div>
          )}
          {g.items.map((item, i) => (
            <DiffRow
              // Two tables can each have an index of the same name, so the path alone does not tell rows apart.
              key={`${item.path}:${i}`}
              item={item}
              showDetail={showDetail}
              selected={selected === item.path}
              onClick={() => onSelect?.(item.path, item)}
              kind={showKind ? diffKindLabel(g.group) : null}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
