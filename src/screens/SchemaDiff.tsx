import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DdlDiff } from '../components/DdlDiff';
import { DiffList } from '../components/DiffList';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { Alert } from '../components/Toast';
import { countChanges, DIFF_GROUPS, diffGroups, diffSchemas, totalChanges, type DiffGroupName, type DiffStats } from '../core/diff';
import { compareDdl } from '../core/diff/ddl';
import { EXPORT_ENGINES, generatorFor, migratorFor } from '../core/generate';
import { t, type MessageKey } from '../core/i18n';
import type { DiffItem } from '../core/model';
import { relativeTime } from '../core/time';
import { versionLabel, type SavedVersion } from '../core/versions';
import { useVersions } from '../db/useSchemas';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { go } from './navigation';
import { SchemaCrumbs } from './SchemaCrumbs';
import { exportDiff, generateMigration } from './versionActions';

const ALL = 'All';
const groupOptions = () => [
  { value: ALL, label: t('common.all') },
  { value: 'Tables', label: t('noun.tables') },
  { value: 'Columns', label: t('compare.columns') },
  { value: 'Indexes', label: t('compare.indexes') },
  { value: 'Relationships', label: t('compare.relationships') },
];
const modeOptions = () => [
  { value: 'split', label: t('compare.split') },
  { value: 'unified', label: t('compare.unified') },
];
/** What the list says when the changes hold none of a group. */
const NONE_OF = {
  Tables: 'compare.noTables',
  Columns: 'compare.noColumns',
  Indexes: 'compare.noIndexes',
  Relationships: 'compare.noRelationships',
} as const satisfies Record<DiffGroupName, MessageKey>;
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
      title={t('compare.stats', { added: stats.added, modified: stats.modified, removed: stats.removed })}
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
  const [group, setGroup] = useState<string>(ALL);
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
    version.version === current ? t('compare.current', { time: relativeTime(version.createdAt, now) }) : relativeTime(version.createdAt, now);
  const groups = compared?.groups.filter((g) => group === ALL || g.group === group) ?? [];
  const destructive = compared?.migration?.destructive ?? [];
  const missing = stored === undefined ? null : !base ? from : !target ? to : null;

  return (
    <>
      <SchemaCrumbs
        title={t('compare.title')}
        actions={
          <>
            <SegmentedControl value={mode} onChange={setMode} options={modeOptions()} />
            <IconButton
              icon="download"
              label={t('compare.exportDiff')}
              disabled={!base || !target}
              onClick={() => base && target && exportDiff(base, target)}
            />
            <Button variant="primary" icon="migration" kbd={['⌘', '⏎']} disabled={!canMigrate} onClick={migrate}>
              {t('action.generateMigration')}
            </Button>
          </>
        }
      >
        <span className="ss-tb-sep" />
        <div style={{ width: 84 }}>
          <Select size="sm" mono value={String(from)} onChange={(v) => compare(Number(v), to)} options={options(to, from)} label={t('compare.base')} />
        </div>
        <Icon name="arrow-right" size={14} style={{ color: 'var(--ink-3)' }} />
        <div style={{ width: 84 }}>
          <Select size="sm" mono value={String(to)} onChange={(v) => compare(from, Number(v))} options={options(from, to)} label={t('compare.target')} />
        </div>
        <IconButton icon="migration" label={t('compare.swap')} size="sm" onClick={() => compare(to, from)} />
        {compared && <Stats stats={compared.stats} />}
      </SchemaCrumbs>
      <div className="ss-work">
        <div style={{ width: 320, flex: 'none', borderRight: '1px solid var(--line-1)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '12px 12px 6px' }}>
            <SegmentedControl block value={group} onChange={setGroup} options={groupOptions()} />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
            <DiffList groups={groups} selected={selected ?? undefined} onSelect={pick} />
            {compared && groups.length === 0 && (
              <div className="ss-faint" style={{ fontSize: 12, padding: '10px 12px' }}>
                {totalChanges(compared.stats)
                  ? t(NONE_OF[DIFF_GROUPS.find((g) => g === group) ?? 'Tables'])
                  : t('compare.noChanges', { from: versionLabel(from), to: versionLabel(to) })}
              </div>
            )}
            {missing !== null && (
              <div className="ss-faint" style={{ fontSize: 12, padding: '10px 12px' }}>
                {t('compare.missing', { version: versionLabel(missing) })}
              </div>
            )}
          </div>
          {destructive.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-1)', padding: 12 }}>
              <Alert tone="warn" title={t('count.destructiveChanges', { count: destructive.length })}>
                {destructive
                  .slice(0, SPELLED_OUT)
                  .map((d) => d.message)
                  .join(' ')}
                {destructive.length > SPELLED_OUT ? ` ${t('common.andMore', { count: destructive.length - SPELLED_OUT })}` : ''}
                {compared?.migration?.atomic
                  ? ` ${t('compare.atomic', { count: destructive.length })}`
                  : ` ${t('compare.notAtomic', { engine: dialect })}`}
              </Alert>
            </div>
          )}
        </div>
        <div ref={pane} style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 16, background: 'var(--bg-1)' }}>
          {compared && base && target && (
            <DdlDiff
              rows={compared.ddl.rows}
              mode={mode === 'unified' ? 'unified' : 'split'}
              leftTitle={t('compare.version', { number: from })}
              leftMeta={meta(base)}
              rightTitle={t('compare.version', { number: to })}
              rightMeta={meta(target)}
            />
          )}
        </div>
      </div>
    </>
  );
}
