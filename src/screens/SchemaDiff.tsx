import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { versionLabel } from '../core/versions';
import { useSchemaStore } from '../store/schema';
import { go } from './navigation';
import { SchemaCrumbs } from './SchemaCrumbs';

export interface SchemaDiffProps {
  /** The version compared from, and the version compared to. */
  from: number;
  to: number;
}

/** Two versions of the open schema, compared. Only its frame so far: the diff arrives with roadmap 5.3. */
export function SchemaDiff({ from, to }: SchemaDiffProps) {
  const name = useSchemaStore((s) => s.name);

  return (
    <>
      <SchemaCrumbs title="Compare">
        <span className="ss-tb-sep" />
        <Badge>{versionLabel(from)}</Badge>
        <Icon name="arrow-right" size={14} style={{ color: 'var(--ink-3)' }} />
        <Badge tone="accent">{versionLabel(to)}</Badge>
      </SchemaCrumbs>
      <div className="ss-page">
        <div className="ss-page-head">
          <div className="ss-page-title">{`${versionLabel(from)} → ${versionLabel(to)}`}</div>
        </div>
        <div className="ss-page-body" style={{ padding: '0 32px 24px' }}>
          <div className="ss-faint">The comparison is not built yet (roadmap 5.3).</div>
          <div style={{ marginTop: 16 }}>
            <Button icon="history" onClick={() => go({ screen: 'history', schema: name })}>
              Version history
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
