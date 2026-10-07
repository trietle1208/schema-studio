import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Kbd } from './Kbd';

function EmptyArt() {
  return (
    <svg className="ss-empty-art" width={360} height={168} viewBox="0 0 360 168" aria-hidden>
      <path className="e" d="M128 44 C 158 44, 158 70, 196 70" />
      <path className="e" d="M128 116 C 162 116, 160 94, 196 94" />
      <g>
        <rect className="n" x={20.5} y={20.5} width={108} height={64} rx={6} />
        <rect className="h" x={21} y={21} width={107} height={15} rx={5.5} />
        <rect className="rk" x={30} y={44} width={6} height={6} rx={1} />
        <rect className="r" x={42} y={45} width={40} height={4} rx={2} />
        <rect className="r" x={42} y={57} width={54} height={4} rx={2} />
        <rect className="r" x={42} y={69} width={30} height={4} rx={2} />
      </g>
      <g>
        <rect className="n" x={20.5} y={96.5} width={108} height={52} rx={6} />
        <rect className="h" x={21} y={97} width={107} height={15} rx={5.5} />
        <rect className="rk" x={30} y={120} width={6} height={6} rx={1} />
        <rect className="r" x={42} y={121} width={34} height={4} rx={2} />
        <rect className="r" x={42} y={133} width={48} height={4} rx={2} />
      </g>
      <g>
        <rect className="n" x={196.5} y={52.5} width={116} height={64} rx={6} />
        <rect className="h" x={197} y={53} width={115} height={15} rx={5.5} />
        <rect className="rk" x={206} y={76} width={6} height={6} rx={1} />
        <rect className="r" x={218} y={77} width={36} height={4} rx={2} />
        <rect className="rf" x={206} y={88} width={6} height={6} rx={1} />
        <rect className="r" x={218} y={89} width={52} height={4} rx={2} />
        <rect className="rf" x={206} y={100} width={6} height={6} rx={1} />
        <rect className="r" x={218} y={101} width={44} height={4} rx={2} />
      </g>
      <rect className="ghost" x={236.5} y={132.5} width={100} height={30} rx={6} />
      <path className="plus" d="M286.5 141.5v12M280.5 147.5h12" />
    </svg>
  );
}

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  // Each action stays disabled without a handler.
  onImport?: () => void;
  onCreate?: () => void;
  /** False hides the footer line. */
  hints?: boolean;
}

export function EmptyState({ title, description, onImport, onCreate, hints }: EmptyStateProps) {
  return (
    <div className="ss-empty">
      <EmptyArt />
      <div className="ss-empty-title">{title || 'Your database schemas will appear here.'}</div>
      <div className="ss-empty-sub">
        {description || 'Import DDL from an existing database, or start a blank schema and draw tables on the canvas.'}
      </div>
      <div className="ss-empty-actions">
        <Button variant="primary" icon="upload" onClick={onImport} disabled={!onImport} kbd={['⌘', 'I']}>
          Import Schema
        </Button>
        <Button icon="plus" onClick={onCreate} disabled={!onCreate} kbd={['⌘', 'N']}>
          Create New Schema
        </Button>
      </div>
      {hints !== false && (
        <div className="ss-empty-keys">
          <span>
            <Icon name="file-code" size={14} />
            Accepts pg_dump, mysqldump and plain DDL
          </span>
          <span>
            <Kbd keys={['⌘', '/']} />
            All shortcuts
          </span>
        </div>
      )}
    </div>
  );
}
