import { cx } from '../cx';

export interface ConnectorRailProps {
  /** WHERE on the first row of a group, then the group's AND or OR. */
  label: 'WHERE' | 'AND' | 'OR';
  /** An OR group draws the rail and its chips in fk. */
  logic: 'AND' | 'OR';
  first: boolean;
  last: boolean;
  /** A nested group is taller than a condition, so the chip sits on its centre. */
  center?: boolean;
}

/** The 52px column that joins a group's rows: a hairline and a chip on each row. */
export function ConnectorRail({ label, logic, first, last, center }: ConnectorRailProps) {
  const or = logic === 'OR';
  return (
    <div className={cx('ss-fb-rail', first && 'is-first', last && 'is-last', center && 'is-center', or && 'is-or')} aria-hidden>
      <span className={cx('ss-fb-chip', or ? 'is-or' : label === 'WHERE' ? 'is-where' : 'is-and')}>{label}</span>
    </div>
  );
}
