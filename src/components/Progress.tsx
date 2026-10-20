export interface ProgressProps {
  value: number;
  max?: number;
  tone?: 'done' | 'error';
  /** The `aria-label`. */
  label?: string;
}

/** A bar for work that knows how much of it is done: Import Records processing its rows. */
export function Progress({ value, max = 100, tone, label }: ProgressProps) {
  const v = Math.max(0, Math.min(max, value || 0));
  return (
    <div
      className={`ss-progress${tone ? ` is-${tone}` : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={v}
      aria-label={label || 'Progress'}
    >
      <span style={{ width: `${max ? (v / max) * 100 : 0}%` }} />
    </div>
  );
}
