import { Button } from '../components/Button';
import { plural } from '../core/plural';
import { versionLabel } from '../core/versions';
import { useSchemaStore } from '../store/schema';
import { go } from './navigation';
import { SchemaCrumbs } from './SchemaCrumbs';

/** The version history of the open schema. Only its frame so far: the version list arrives with roadmap 5.2. */
export function VersionHistory() {
  const name = useSchemaStore((s) => s.name);
  const version = useSchemaStore((s) => s.version) ?? 0;

  return (
    <>
      <SchemaCrumbs title="Version history" />
      <div className="ss-page">
        <div className="ss-page-head">
          <div className="ss-page-title">Version history</div>
          <span className="ss-page-count">{plural(version, 'version')}</span>
        </div>
        <div className="ss-page-body" style={{ padding: '0 32px 24px' }}>
          <div className="ss-faint">The list of versions is not built yet (roadmap 5.2).</div>
          {version > 1 && (
            <div style={{ marginTop: 16 }}>
              <Button
                icon="migration"
                onClick={() => go({ screen: 'diff', schema: name, from: version - 1, to: version })}
              >{`Compare ${versionLabel(version - 1)} with ${versionLabel(version)}`}</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
