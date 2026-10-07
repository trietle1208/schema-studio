import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DdlDiff } from '../components/DdlDiff';
import { DiffList } from '../components/DiffList';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { Alert } from '../components/Toast';
import { countChanges, diffGroups, diffSchemas, totalChanges, type DiffStats } from '../core/diff';
import { compareDdl } from '../core/diff/ddl';
import { EXPORT_ENGINES, generatorFor, migratorFor } from '../core/generate';
import type { DiffItem } from '../core/model';
import { plural } from '../core/plural';
import { relativeTime } from '../core/time';
import { versionLabel, type SavedVersion } from '../core/versions';
import { useVersions } from '../db/useSchemas';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { go } from './navigation';
import { SchemaCrumbs } from './SchemaCrumbs';
import { exportDiff, generateMigration } from './versionActions';

const ALL = 'All';
const GROUPS = [
  { value: ALL, label: 'All' },
  { value: 'Tables', label: 'Tables' },
  { value: 'Columns', label: 'Cols' },
  { value: 'Indexes', label: 'Idx' },
  { value: 'Relationships', label: 'Rels' },
];
const MODES = [
  { value: 'split', label: 'Side by side' },
  { value: 'unified', label: 'Unified' },
];
/** How many destructive changes the warning spells out before it only counts the rest. */
const SPELLED_OUT = 2;

export interface SchemaDiffProps {
  /** The version compared from, and the version compared to. */
  from: number;
  to: number;
  /** The time the versions' ages count back from. */
  now: number;
}

function Stats({ stats }: { stats: DiffStats }) {
  return (
    <span
      className="ss-ver-stats"
      style={{ marginLeft: 6 }}
      title={`${stats.added} added, ${stats.modified} changed, ${stats.removed} removed`}
    >
      <span className="a">{`+${stats.added}`}</span>
      <span className="m">{`~${stats.modified}`}</span>
      <span className="r">{`−${stats.removed}`}</span>
    </span>
  );
}

/** Two versions of the open schema, compared: what changed, and the DDL of both side by side. */
export function SchemaDiff({ from, to, now }: SchemaDiffProps) {
  const id = useSchemaStore((s) => s.id);
  const name = useSchemaStore((s) => s.name);
  const engine = useSchemaStore((s) => s.engine);
  const stored = useVersions(id);
  const [mode, setMode] = useState('split');
  const [group, setGroup] = useState(ALL);
  const [selected, setSelected] = useState<string | null>(null);
  const pane = useRef<HTMLDivElement>(null);

  const base: SavedVersion | undefined = stored?.find((v) => v.version === from);
  const target: SavedVersion | undefined = stored?.find((v) => v.version === to);
  // DDL is written for an engine that has a generator, whatever the schema was made for.
  const dialect = EXPORT_ENGINES.includes(engine) ? engine : EXPORT_ENGINES[0];

  const compared = useMemo(() => {
    if (!base || !target) return null;
    const before = base.snapshot.tables;
    const after = target.snapshot.tables;
    const changes = diffSchemas(before, after);
    const generator = generatorFor(dialect);
    return {
      groups: diffGroups(changes),
      stats: countChanges(changes),
      ddl: compareDdl(generator?.blocks(before) ?? [], generator?.blocks(after) ?? []),
      migration: migratorFor(dialect)?.migrate(before, after) ?? null,
    };
  }, [base, target, dialect]);

  const canMigrate = !!compared?.migration?.statements;
  const migrate = () => {
    if (base && target && canMigrate) generateMigration(base, target);
  };
  // ⌘⏎ generates the migration. The handler is renewed on every render, so it sees the current versions.
  const confirm = useRef(migrate);
  useEffect(() => {
    confirm.current = migrate;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      // An open dialog owns the keyboard.
      if (useUiStore.getState().dialog) return;
      e.preventDefault();
      confirm.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const compare = (a: number, b: number) => go({ screen: 'diff', schema: name, from: a, to: b });
  const numbers = (stored ?? []).map((v) => v.version);
  const options = (other: number, own: number) =>
    // The version in the address is listed even when it does not exist, so the control can show it.
    [...new Set([own, ...numbers])].filter((n) => n !== other).sort((a, b) => b - a).map((n) => ({ value: String(n), label: versionLabel(n) }));

  /** A change that is picked in the list is scrolled to in the DDL. */
  const pick = (path: string, item: DiffItem) => {
    setSelected(path);
    const row = item.anchor === undefined ? undefined : compared?.ddl.anchors[item.anchor];
    if (row !== undefined) pane.current?.querySelector(`[data-row="${row}"]`)?.scrollIntoView({ block: 'center' });
  };

  const current = Math.max(0, ...numbers);
  const meta = (version: SavedVersion) =>
    `${version.version === current ? 'Current · ' : ''}${relativeTime(version.createdAt, now)}`;
  const groups = compared?.groups.filter((g) => group === ALL || g.group === group) ?? [];
  const destructive = compared?.migration?.destructive ?? [];
  const missing = stored === undefined ? null : !base ? from : !target ? to : null;

  return (
    <>
      <SchemaCrumbs
        title="Compare"
        actions={
          <>
            <SegmentedControl value={mode} onChange={setMode} options={MODES} />
            <IconButton
              icon="download"
              label="Export diff"
              disabled={!base || !target}
              onClick={() => base && target && exportDiff(base, target)}
            />
            <Button variant="primary" icon="migration" kbd={['⌘', '⏎']} disabled={!canMigrate} onClick={migrate}>
              Generate Migration
            </Button>
          </>
        }
      >
        <span className="ss-tb-sep" />
        <div style={{ width: 84 }}>
          <Select size="sm" mono value={String(from)} onChange={(v) => compare(Number(v), to)} options={options(to, from)} label="Base" />
        </div>
        <Icon name="arrow-right" size={14} style={{ color: 'var(--ink-3)' }} />
        <div style={{ width: 84 }}>
          <Select size="sm" mono value={String(to)} onChange={(v) => compare(from, Number(v))} options={options(from, to)} label="Target" />
        </div>
        <IconButton icon="migration" label="Swap versions" size="sm" onClick={() => compare(to, from)} />
        {compared && <Stats stats={compared.stats} />}
      </SchemaCrumbs>
      <div className="ss-work">
        <div style={{ width: 320, flex: 'none', borderRight: '1px solid var(--line-1)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 12px 6px' }}>
            <SegmentedControl block value={group} onChange={setGroup} options={GROUPS} />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
            <DiffList groups={groups} selected={selected ?? undefined} onSelect={pick} />
            {compared && groups.length === 0 && (
              <div className="ss-faint" style={{ fontSize: 12, padding: '10px 12px' }}>
                {totalChanges(compared.stats)
                  ? `No ${group.toLowerCase()} changed.`
                  : `No changes between ${versionLabel(from)} and ${versionLabel(to)}.`}
              </div>
            )}
            {missing !== null && (
              <div className="ss-faint" style={{ fontSize: 12, padding: '10px 12px' }}>
                {`Version ${versionLabel(missing)} does not exist.`}
              </div>
            )}
          </div>
          {destructive.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-1)', padding: 12 }}>
              <Alert tone="warn" title={plural(destructive.length, 'destructive change')}>
                {destructive
                  .slice(0, SPELLED_OUT)
                  .map((d) => d.message)
                  .join(' ')}
                {destructive.length > SPELLED_OUT ? ` And ${destructive.length - SPELLED_OUT} more.` : ''}
                {` The migration wraps ${destructive.length === 1 ? 'it' : 'them'} in a transaction.`}
              </Alert>
            </div>
          )}
        </div>
        <div ref={pane} style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 16, background: 'var(--bg-1)' }}>
          {compared && base && target && (
            <DdlDiff
              rows={compared.ddl.rows}
              mode={mode === 'unified' ? 'unified' : 'split'}
              leftTitle={`Version ${from}`}
              leftMeta={meta(base)}
              rightTitle={`Version ${to}`}
              rightMeta={meta(target)}
            />
          )}
        </div>
      </div>
    </>
  );
}
