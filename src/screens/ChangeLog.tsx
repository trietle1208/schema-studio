import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { ContextMenu } from '../components/ContextMenu';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { rich } from '../components/rich';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { usePopover } from '../components/usePopover';
import { analyzeSql, warningText } from '../core/changes/analyzeSql';
import { deployRows } from '../core/changes/deploy';
import {
  deployServer,
  filterChanges,
  groupChanges,
  outstandingOn,
  pendingOn,
  failedOn,
  runCounts,
  type RunFilter,
} from '../core/changes/group';
import { SERVER_IDS, SERVERS, seqLabel, serverOf, setRun, undoRun, type RunStatus, type ServerId } from '../core/changes/model';
import { groupName, serverName, statusName } from '../core/changes/text';
import { t } from '../core/i18n';
import { stepSelection } from '../core/schemaList';
import type { ChangeRecord, SchemaRecord } from '../db/db';
import { useUiStore } from '../store/ui';
import { ChangeDetail } from './ChangeDetail';
import { createChange, markRan, saveChange } from './changeActions';
import { DeployDialog } from './DeployDialog';

const NO_CHANGES: ChangeRecord[] = [];
const NO_SCHEMAS: SchemaRecord[] = [];

/** The databases a change can be for: the ones the log already has, the newest change's first, and then the stored schemas. */
function databasesOf(changes: readonly ChangeRecord[], schemas: readonly SchemaRecord[]): string[] {
  return [...new Set([...changes.map((c) => c.database), ...schemas.map((s) => s.name)])];
}

const runFilters = (counts: Record<RunFilter, number>) => [
  { value: 'all', label: <Counted label={t('changes.filter.all')} count={counts.all} /> },
  { value: 'pending', label: <Counted label={t('changes.filter.pending')} count={counts.pending} /> },
  { value: 'failed', label: <Counted label={t('changes.filter.failed')} count={counts.failed} /> },
];

function Counted({ label, count }: { label: string; count: number }) {
  return (
    <>
      {label}
      <span className="ss-cl-count">{count}</span>
    </>
  );
}

/** One run of a change on one server, as a dot: filled when run, dashed while it waits, red when it failed, a dash when it does not apply. */
function RunDot({ server, status }: { server: ServerId; status: RunStatus }) {
  const label = t('changes.run.title', { server: serverName(server), status: statusName(status) });
  return (
    <span className={cx('ss-cl-r', `is-${status}`)} role="img" aria-label={label} title={label}>
      {status === 'ran' && <Icon name="check" size={11} strokeWidth={2.5} />}
      {status === 'failed' && <Icon name="x" size={11} strokeWidth={2.5} />}
    </span>
  );
}

interface ChangeRowProps {
  change: ChangeRecord;
  selected: boolean;
  onSelect: () => void;
}

function ChangeRow({ change, selected, onSelect }: ChangeRowProps) {
  const warning = useMemo(() => analyzeSql(change.sql, change.engine), [change.sql, change.engine]);
  return (
    <button type="button" className={cx('ss-cl-row', selected && 'is-selected')} aria-current={selected || undefined} onClick={onSelect}>
      <span className="ss-cl-seq">{seqLabel(change.seq)}</span>
      <span className="ss-cl-ttl">
        {change.key && <span className="ss-cl-key">{change.key}</span>}
        <span className={cx('ss-cl-ttl-t', !change.title && 'is-placeholder')}>{change.title || t('changes.untitled')}</span>
        {warning?.destructive && (
          <span className="ss-cl-warn" role="img" aria-label={warningText(warning)} title={warningText(warning)}>
            <Icon name="warning" size={14} />
          </span>
        )}
      </span>
      <span className="ss-cl-dbn">{change.database}</span>
      <span className="ss-cl-pr">
        {change.pr && (
          <>
            <span className={cx('ss-cl-pr-dot', `is-${change.pr.state}`)} />
            {`#${change.pr.number}`}
          </>
        )}
      </span>
      <span className="ss-cl-runs">
        {SERVER_IDS.map((id) => (
          <RunDot key={id} server={id} status={change.runs[id].status} />
        ))}
      </span>
    </button>
  );
}

export interface ChangeLogProps {
  /** Every change of the log, the newest first; undefined while they are being read. */
  changes: ChangeRecord[] | undefined;
  /** Every stored schema: a change can be written for a database that has one, whatever the log holds. */
  schemas: SchemaRecord[] | undefined;
  /** The time the groups of the list count back from. */
  now: number;
}

/** The change log: which server is still missing which change, with the detail of a change beside it and the deploy over it. */
export function ChangeLog({ changes, schemas, now }: ChangeLogProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [server, setServer] = useState<ServerId | null>(null);
  const [run, setRunFilter] = useState<RunFilter>('all');
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [deploy, setDeploy] = useState<{ database: string; server: ServerId } | null>(null);
  const [confirm, setConfirm] = useState<{ seq: number; server: ServerId } | null>(null);
  const [menuOpen, setMenuOpen, menuRef] = usePopover();
  const page = useRef<HTMLDivElement>(null);

  const all = changes ?? NO_CHANGES;
  const databases = useMemo(() => databasesOf(all, schemas ?? NO_SCHEMAS), [all, schemas]);
  const database = picked !== null && databases.includes(picked) ? picked : (databases[0] ?? '');
  const visible = useMemo(() => filterChanges(all, server, run), [all, server, run]);
  const counts = useMemo(() => runCounts(all, server), [all, server]);
  const groups = useMemo(() => groupChanges(visible, now), [visible, now]);
  const selected = selectedSeq === null ? undefined : all.find((c) => c.seq === selectedSeq);
  const modal = deploy !== null || confirm !== null;

  // Esc closes the detail; ↑ ↓ move from change to change. A dialog or a menu that is open keeps its own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || menuOpen || useUiStore.getState().dialog || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (selectedSeq !== null) setSelectedSeq(null);
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      setSelectedSeq((current) =>
        stepSelection(
          visible.map((c) => c.seq),
          current,
          e.key === 'ArrowDown' ? 1 : -1,
        ),
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, menuOpen, selectedSeq, visible]);

  useEffect(() => {
    page.current?.querySelector('.ss-cl-row.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selectedSeq]);

  if (!changes) return null;

  const engineOf = (name: string) => all.find((c) => c.database === name)?.engine ?? schemas?.find((s) => s.name === name)?.engine ?? '';

  const newChange = async (kind: 'blank' | 'diff') => {
    if (!database) return;
    const created = await createChange(kind, database, engineOf(database));
    if (created) setSelectedSeq(created.seq);
  };

  const prepareDeploy = () => {
    const target = deployServer(all, database, server);
    if (target && deployRows(all, database, target).length > 0) {
      setDeploy({ database, server: target });
      return;
    }
    useUiStore.getState().showToast({
      tone: 'info',
      title: t('changes.deploy.nothing.title'),
      description: target
        ? t('changes.deploy.nothing.description', { database, server: serverName(target) })
        : t('changes.deploy.nothingAny.description', { database }),
    });
  };

  // Marking a run on a server that is protected asks first; every other mark is written at once.
  const markRun = (change: ChangeRecord, id: ServerId, status: RunStatus) => {
    if (change.runs[id].status === status) return;
    if (status === 'ran' && serverOf(id).protected) setConfirm({ seq: change.seq, server: id });
    else void saveChange(setRun(change, id, status, status === 'ran' ? Date.now() : undefined));
  };

  // The server that is lit in the strip: the one the deploy is for, else the one that filters the list.
  const lit = deploy?.server ?? server;

  return (
    <>
      <div className="ss-cl">
        <div className="ss-cl-scroll" ref={page}>
          <div className="ss-cl-wrap">
            <div className="ss-cl-head">
              <h1 className="ss-cl-title">{t('changes.title')}</h1>
              {databases.length > 0 && (
                <div className="ss-cl-db">
                  <Select mono label={t('field.database')} value={database} options={databases} onChange={setPicked} />
                </div>
              )}
              <span className="ss-spacer" />
              <Button icon="rocket" disabled={!database} onClick={prepareDeploy}>
                {t('changes.prepareDeploy')}
              </Button>
              <div className="ss-anchor" ref={menuRef}>
                <Button
                  variant="primary"
                  icon="plus"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  disabled={!database}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {t('changes.newChange')}
                </Button>
                {menuOpen && (
                  <div className="ss-anchor-pop ss-anchor-pop--end">
                    <ContextMenu
                      onClose={() => setMenuOpen(false)}
                      items={[
                        { icon: 'file', label: t('changes.new.blank'), onSelect: () => void newChange('blank') },
                        { icon: 'diff', label: t('changes.new.fromDiff'), onSelect: () => void newChange('diff') },
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="ss-cl-strip" role="group" aria-label={t('changes.detail.servers')}>
              {SERVERS.map((s) => {
                const outstanding = outstandingOn(all, s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={cx('ss-cl-srv', `ss-group--${s.color}`, lit === s.id && 'is-on')}
                    aria-pressed={server === s.id}
                    title={t('changes.server.counts', { pending: pendingOn(all, s.id), failed: failedOn(all, s.id) })}
                    onClick={() => setServer(server === s.id ? null : s.id)}
                  >
                    <span className="ss-cl-dot" />
                    <span className="ss-cl-srv-name">{serverName(s.id)}</span>
                    {outstanding > 0 ? (
                      <>
                        <span className="ss-cl-n">{outstanding}</span>
                        <span className="ss-cl-lbl">{t('changes.server.pending')}</span>
                      </>
                    ) : (
                      <span className="ss-cl-ok">
                        <Icon name="check" size={14} />
                        {t('changes.server.upToDate')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ss-cl-tools">
              <SegmentedControl value={run} onChange={(value) => setRunFilter(value as RunFilter)} options={runFilters(counts)} />
              <span className="ss-spacer" />
              <span className="ss-cl-saved">
                <Icon name="git" size={13} />
                {rich('changes.savedTo', { path: <span className="ss-mono ss-cl-saved-path">db/changes/</span> })}
              </span>
            </div>

            <div className="ss-cl-list">
              <div className="ss-cl-lh">
                <span>#</span>
                <span>{t('changes.col.change')}</span>
                <span>{t('field.database')}</span>
                <span>{t('changes.col.pr')}</span>
                <span className="ss-cl-runs">
                  {SERVERS.map((s) => (
                    <span key={s.id} title={serverName(s.id)}>
                      {s.letter}
                    </span>
                  ))}
                </span>
              </div>
              {groups.map((g) => (
                <section key={g.group}>
                  <div className="ss-cl-grp">{groupName(g.group)}</div>
                  {g.changes.map((c) => (
                    <ChangeRow key={c.seq} change={c} selected={c.seq === selectedSeq} onSelect={() => setSelectedSeq(c.seq)} />
                  ))}
                </section>
              ))}
              {visible.length === 0 &&
                (all.length > 0 ? (
                  <div className="ss-cl-empty">{t('changes.noMatch')}</div>
                ) : (
                  <div className="ss-cl-empty">
                    <div className="ss-cl-empty-title">{t('changes.none.title')}</div>
                    {database ? t('changes.none.description', { database }) : t('changes.none.noDatabase')}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {selected && (
          <ChangeDetail
            key={selected.seq}
            change={selected}
            onClose={() => setSelectedSeq(null)}
            onSetRun={(id, status) => markRun(selected, id, status)}
            onUndoRun={(id) => void saveChange(undoRun(selected, id))}
          />
        )}
      </div>

      {deploy && <DeployDialog changes={all} database={deploy.database} server={deploy.server} now={now} onClose={() => setDeploy(null)} />}
      {confirm && (
        <ConfirmDialog
          title={t('changes.confirm.title', { seq: seqLabel(confirm.seq), server: serverName(confirm.server) })}
          confirmLabel={t('changes.confirm.action')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void markRan([confirm.seq], confirm.server);
          }}
        >
          <div style={{ color: 'var(--ink-2)' }}>{t('changes.confirm.body', { server: serverName(confirm.server) })}</div>
        </ConfirmDialog>
      )}
    </>
  );
}
