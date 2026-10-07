import type { CSSProperties, ReactNode } from 'react';
import { changedPart, type DdlRow } from '../core/diff/ddl';
import { highlightSql } from '../core/highlight';
import { cx } from './cx';
import { Icon } from './Icon';
import { SqlTokens } from './SqlTokens';

export interface DdlDiffProps {
  /** `[left, right?, kind?, foldCount?]`; see `DdlRow`. */
  rows: readonly DdlRow[];
  leftTitle?: ReactNode;
  rightTitle?: ReactNode;
  leftMeta?: ReactNode;
  rightMeta?: ReactNode;
  /** `split` (the default) puts the two versions side by side; `unified` lists their lines in one column. */
  mode?: 'split' | 'unified';
  style?: CSSProperties;
}

// The unified view has a line number for each version; bundle.css lays a line out with one.
const UNIFIED_LINE: CSSProperties = { gridTemplateColumns: '38px 38px 16px 1fr' };

const Sql = ({ text }: { text: string }) => (
  <span>
    <SqlTokens tokens={highlightSql(text)} />
  </span>
);

/**
 * Every line is marked with `data-row`, the index of its row in `rows`, so that a row can be found
 * and scrolled to.
 */
export function DdlDiff({ rows, leftTitle, rightTitle, leftMeta, rightMeta, mode = 'split', style }: DdlDiffProps) {
  let ln = 0;
  let rn = 0;
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];
  /** The lines of the unified view. */
  const lines: ReactNode[] = [];
  const unified = (key: string, row: number, kind: 'add' | 'del' | null, before: number | null, after: number | null, content: ReactNode) =>
    lines.push(
      <div key={key} data-row={row} className={cx('ss-ddl-line', kind && `k-${kind}`)} style={UNIFIED_LINE}>
        <span className="ss-ddl-n">{before}</span>
        <span className="ss-ddl-n">{after}</span>
        <span className="ss-ddl-s">{kind === 'add' ? '+' : kind === 'del' ? '−' : ''}</span>
        {content}
      </div>,
    );

  rows.forEach((r, idx) => {
    const k = r[2] ?? 'same';
    if (k === 'fold') {
      left.push(
        <div key={idx} data-row={idx} className="ss-ddl-line k-fold">
          <span />
          <span />
          {r[0]}
        </div>,
      );
      right.push(
        <div key={idx} className="ss-ddl-line r k-fold">
          <span />
          <span />
          {r[0]}
        </div>,
      );
      lines.push(
        <div key={idx} data-row={idx} className="ss-ddl-line k-fold" style={UNIFIED_LINE}>
          <span />
          <span />
          <span />
          {r[0]}
        </div>,
      );
      ln += r[3] ?? 0;
      rn += r[3] ?? 0;
      return;
    }
    const before = r[0];
    const after = r[1] === undefined ? r[0] : r[1];
    if (k === 'mod' && before !== null && after !== null) {
      const d = changedPart(before, after);
      ln++;
      rn++;
      const removed = (
        <span>
          {d.pre}
          <span className="ss-ddl-hl-del">{d.before}</span>
          {d.post}
        </span>
      );
      const added = (
        <span>
          {d.pre}
          <span className="ss-ddl-hl-add">{d.after}</span>
          {d.post}
        </span>
      );
      left.push(
        <div key={idx} data-row={idx} className="ss-ddl-line k-del">
          <span className="ss-ddl-n">{ln}</span>
          <span className="ss-ddl-s">−</span>
          {removed}
        </div>,
      );
      right.push(
        <div key={idx} className="ss-ddl-line r k-add">
          <span className="ss-ddl-n">{rn}</span>
          <span className="ss-ddl-s">+</span>
          {added}
        </div>,
      );
      unified(`${idx}-`, idx, 'del', ln, null, removed);
      unified(`${idx}+`, idx, 'add', null, rn, added);
      return;
    }
    if (before == null) {
      left.push(
        <div key={idx} data-row={idx} className="ss-ddl-line k-gap">
          <span />
          <span />
        </div>,
      );
    } else {
      ln++;
      left.push(
        <div key={idx} data-row={idx} className={cx('ss-ddl-line', k === 'del' && 'k-del')}>
          <span className="ss-ddl-n">{ln}</span>
          <span className="ss-ddl-s">{k === 'del' ? '−' : ''}</span>
          <Sql text={before} />
        </div>,
      );
    }
    if (after == null || k === 'del') {
      right.push(
        <div key={idx} className="ss-ddl-line r k-gap">
          <span />
          <span />
        </div>,
      );
    } else {
      rn++;
      right.push(
        <div key={idx} className={cx('ss-ddl-line r', k === 'add' && 'k-add')}>
          <span className="ss-ddl-n">{rn}</span>
          <span className="ss-ddl-s">{k === 'add' ? '+' : ''}</span>
          <Sql text={after} />
        </div>,
      );
    }
    if (k === 'del') unified(String(idx), idx, 'del', ln, null, <Sql text={before ?? ''} />);
    else if (k === 'add') unified(String(idx), idx, 'add', null, rn, <Sql text={after ?? ''} />);
    else unified(String(idx), idx, null, ln, rn, <Sql text={after ?? ''} />);
  });

  if (mode === 'unified') {
    return (
      <div className="ss-ddl" style={{ gridTemplateColumns: 'minmax(0,1fr)', ...style }}>
        <div className="ss-ddl-head">
          {leftTitle}
          <Icon name="arrow-right" size={14} style={{ color: 'var(--ink-3)' }} />
          {rightTitle}
          <span className="ss-faint" style={{ fontWeight: 400 }}>
            {rightMeta}
          </span>
        </div>
        <div className="ss-ddl-side">{lines}</div>
      </div>
    );
  }
  return (
    <div className="ss-ddl" style={style}>
      <div className="ss-ddl-head">
        {leftTitle}
        <span className="ss-faint" style={{ fontWeight: 400 }}>
          {leftMeta}
        </span>
      </div>
      <div className="ss-ddl-head">
        {rightTitle}
        <span className="ss-faint" style={{ fontWeight: 400 }}>
          {rightMeta}
        </span>
      </div>
      <div className="ss-ddl-side">{left}</div>
      <div className="ss-ddl-side">{right}</div>
    </div>
  );
}
