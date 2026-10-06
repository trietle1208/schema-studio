export interface LogoProps {
  size?: number;
  markOnly?: boolean;
}

export function Logo({ size = 20, markOnly }: LogoProps) {
  const mark = (
    <svg className="ss-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x={2} y={2.5} width={10} height={8} rx={2} style={{ fill: 'var(--accent)' }} />
      <rect
        x={12.75}
        y={13.75}
        width={8.5}
        height={7}
        rx={2}
        style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.75 }}
      />
      <path
        d="M7 10.5v4.25a2.5 2.5 0 0 0 2.5 2.5h3.25"
        style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.75, strokeLinecap: 'round' }}
      />
    </svg>
  );
  if (markOnly) return mark;
  return (
    <span className="ss-row" style={{ gap: 8 }}>
      {mark}
      <span style={{ font: '600 13px/16px var(--font-sans)', letterSpacing: '-.01em' }}>Schema Studio</span>
    </span>
  );
}
