import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DiffList } from '../components/DiffList';
import { ERCanvas, type ERCanvasActions } from '../components/ERCanvas';
import { Input } from '../components/Input';
import { VersionList } from '../components/VersionList';
import { blockTable } from '../core/generate/options';
import { groupsOf } from '../core/groups';
import { t } from '../core/i18n';
import type { DiffItem } from '../core/model';
import { filterVersions, versionEntries, versionLabel, versionSummary, type VersionEntry } from '../core/versions';
import { useVersions } from '../db/useSchemas';
import { useSchemaStore } from '../store/schema';
import { go } from './navigation';
import { SchemaCrumbs } from './SchemaCrumbs';
import { exportVersion, requestRestore } from './versionActions';

const PANEL = { background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' };
const PANEL_HEAD = { padding: '10px 12px', borderBottom: '1px solid var(--line-1)' };

export interface VersionHistoryProps {
  /** The time the list counts back from. */
  now: number;
}

/** The saved versions of the open schema: the list on the left, and what the selected one changed and holds. */
export function VersionHistory({ now }: VersionHistoryProps) {
  const id = useSchemaStore((s) => s.id);
  const stored = useVersions(id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number | null>(null);

  const entries = useMemo(() => versionEntries(stored ?? []), [stored]);
  const shown = useMemo(() => filterVersions(entries, query), [entries, query]);
  const current = entries[0]?.version ?? 0;

  // A version that has just been saved, as by Restore, is the one to look at.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setPicked(null);
  }

  // Without a pick, or when the filter hides it, the newest of the listed versions is selected.
  const selected = shown.find((e) => e.version === picked) ?? shown[0] ?? null;

  return (
    <>
      <SchemaCrumbs title={t('history.title')} />
      <div className="ss-work">
        <div style={{ width: 340, flex: 'none', borderRight: '1px solid var(--line-1)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px 10px' }}>
            <div className="ss-row">
              <div className="ss-modal-title">{t('history.title')}</div>
              <span className="ss-page-count">{t('count.versions', { count: entries.length })}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Input
                icon="search"
                size="sm"
                placeholder={t('history.filter')}
                aria-label={t('history.filterLabel')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <VersionList
              versions={shown.map((e) => versionSummary(e, current, now))}
              selected={selected ? versionLabel(selected.version) : undefined}
              onSelect={(label) => setPicked(shown.find((e) => versionLabel(e.version) === label)?.version ?? null)}
            />
            {stored !== undefined && shown.length === 0 && (
              <div className="ss-faint" style={{ fontSize: 12, padding: '8px 24px' }}>
                {entries.length ? t('history.noMatch', { query: query.trim() }) : t('history.none')}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--bg-1)' }}>
          {selected && <VersionDetail key={selected.version} entry={selected} current={current} now={now} />}
        </div>
      </div>
    </>
  );
}

interface VersionDetailProps {
  entry: VersionEntry;
  /** The number of the schema's current version. */
  current: number;
  now: number;
}

/** One version: its numbers, what it changed from the version before, and its diagram. */
function VersionDetail({ entry, current, now }: VersionDetailProps) {
  const name = useSchemaStore((s) => s.name);
  const summary = versionSummary(entry, current, now);
  const { tables, positions } = entry.snapshot;
  const groups = groupsOf(entry.snapshot);
  const [change, setChange] = useState<string | null>(null);
  const [table, setTable] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<ERCanvasActions>(null);

  // The whole diagram shows at first, whatever its size.
  useEffect(() => {
    canvas.current?.fit();
  }, []);

  /** A change that is picked in the list shows its table in the diagram, when the version still has it. */
  const pick = (path: string, item: DiffItem) => {
    setChange(path);
    const about = item.anchor ? blockTable(item.anchor) : null;
    setTable(about !== null && tables.some((t) => t.name === about) ? about : null);
  };

  return (
    <>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line-1)', background: 'var(--bg-2)' }}>
        <div className="ss-row" style={{ gap: 10 }}>
          <span className="ss-page-title" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
            {`${name} ${summary.version}`}
          </span>
          {summary.current && (
            <Badge tone="accent" sans>
              {t('version.current')}
            </Badge>
          )}
          <span className="ss-spacer" />
          <Button
            icon="diff"
            disabled={entry.previous === null}
            onClick={() => {
              if (entry.previous !== null) go({ screen: 'diff', schema: name, from: entry.previous, to: entry.version });
            }}
          >
            {t('history.compare', { version: entry.previous === null ? '—' : versionLabel(entry.previous) })}
          </Button>
          <Button icon="restore" disabled={summary.current} onClick={() => requestRestore(entry.version)}>
            {t('action.restore')}
          </Button>
          <Button variant="primary" icon="download" onClick={() => exportVersion(entry)}>
            {t('common.export')}
          </Button>
        </div>
        <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>{summary.message}</div>
        <div className="ss-stats" style={{ marginTop: 16 }}>
          <div className="ss-stat">
            <span className="ss-stat-k">{t('noun.tables')}</span>
            <span className="ss-stat-v">{summary.tables}</span>
          </div>
          <div className="ss-stat">
            <span className="ss-stat-k">{t('noun.relationships')}</span>
            <span className="ss-stat-v">{summary.relationships}</span>
          </div>
          <div className="ss-stat">
            <span className="ss-stat-k">{t('noun.indexes')}</span>
            <span className="ss-stat-v">{summary.indexes}</span>
          </div>
          <div className="ss-stat">
            <span className="ss-stat-k">{t('history.saved')}</span>
            <span className="ss-stat-v" style={{ fontSize: 13 }} title={summary.time}>
              {summary.timestamp}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 16, padding: 16, alignItems: 'start' }}>
        <div style={PANEL}>
          <div className="ss-row" style={PANEL_HEAD}>
            <span style={{ fontWeight: 600 }}>{t('history.changes')}</span>
            <span className="ss-faint" style={{ fontSize: 12 }}>
              {entry.previous === null ? t('history.initial') : t('history.versus', { version: versionLabel(entry.previous) })}
            </span>
            <span className="ss-spacer" />
            <span className="ss-ver-stats">
              {summary.added ? <span className="a">{`+${summary.added}`}</span> : null}
              {summary.modified ? <span className="m">{`~${summary.modified}`}</span> : null}
              {summary.removed ? <span className="r">{`−${summary.removed}`}</span> : null}
            </span>
          </div>
          <div style={{ padding: '2px 0 8px' }}>
            {entry.groups.length ? (
              <DiffList groups={entry.groups} selected={change ?? undefined} onSelect={pick} />
            ) : (
              <div className="ss-faint" style={{ fontSize: 12, padding: '10px 12px 4px' }}>
                {entry.previous === null
                  ? t('history.startedEmpty')
                  : t('history.noChanges')}
              </div>
            )}
          </div>
        </div>
        <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', height: 540 }}>
          <div className="ss-row" style={PANEL_HEAD}>
            <span style={{ fontWeight: 600 }}>{t('history.snapshot')}</span>
            <span className="ss-faint" style={{ fontSize: 12 }}>{t('history.readOnly', { tables: t('count.tables', { count: tables.length }) })}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ERCanvas
              tables={tables}
              positions={positions}
              groups={groups}
              zoom={zoom}
              onZoom={setZoom}
              selected={table}
              onSelect={setTable}
              dimUnrelated
              readOnly
              showLegend={false}
              showMinimap={false}
              hint={tables.length === 0 ? t('history.versionEmpty') : undefined}
              actionsRef={canvas}
            />
          </div>
        </div>
      </div>
    </>
  );
}
