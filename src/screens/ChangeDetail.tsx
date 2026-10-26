import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { ContextMenu, type MenuItem } from '../components/ContextMenu';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { IconButton } from '../components/IconButton';
import { SqlTokens } from '../components/SqlTokens';
import { usePopover } from '../components/usePopover';
import { analyzeSql, warningText } from '../core/changes/analyzeSql';
import { nextServer } from '../core/changes/group';
import { SERVERS, seqLabel, type RunStatus, type Server, type ServerId } from '../core/changes/model';
import { runDay, serverName, statusName } from '../core/changes/text';
import { highlightSql } from '../core/highlight';
import { t } from '../core/i18n';
import { dateTime } from '../core/time';
import type { ChangeRecord } from '../db/db';
import { copyText } from './changeActions';
import { copyExport } from './exportActions';

type Tab = 'sql' | 'rollback' | 'notes';

const TABS: Tab[] = ['sql', 'rollback', 'notes'];

const tabName = (tab: Tab) => t(`changes.tab.${tab}`);

export interface ChangeDetailProps {
  change: ChangeRecord;
  onClose: () => void;
  /** Sets the run on a server. The screen asks first where the server is protected. */
  onSetRun: (server: ServerId, status: RunStatus) => void;
  /** Takes back the last setting of the run on a server. */
  onUndoRun: (server: ServerId) => void;
}

interface ServerCellProps {
  change: ChangeRecord;
  server: Server;
  /** Where the menu opens: toward the middle of the drawer. */
  menuFrom: 'start' | 'end';
  next: boolean;
  onSetRun: (server: ServerId, status: RunStatus) => void;
  onUndoRun: (server: ServerId) => void;
}

/** One server of a change: where it stands, a click to mark it as run while it waits, and a menu for the other settings. */
function ServerCell({ change, server, menuFrom, next, onSetRun, onUndoRun }: ServerCellProps) {
  const [open, setOpen, ref] = usePopover();
  const run = change.runs[server.id];
  const name = serverName(server.id);
  const status = run.status === 'ran' && run.at !== undefined ? t('changes.cell.ran', { date: runDay(run.at) }) : statusName(run.status);

  const items: (MenuItem | '-')[] = [];
  if (run.status !== 'ran') items.push({ icon: 'check', label: t('changes.cell.markRun'), onSelect: () => onSetRun(server.id, 'ran') });
  if (run.status === 'pending' || run.status === 'ran') items.push({ icon: 'alert', label: t('changes.cell.markFailed'), onSelect: () => onSetRun(server.id, 'failed') });
  if (run.status === 'pending' || run.status === 'failed') items.push({ icon: 'minus', label: t('changes.cell.skip'), onSelect: () => onSetRun(server.id, 'na') });
  if (run.undo) items.push('-', { icon: 'undo', label: t('common.undo'), onSelect: () => onUndoRun(server.id) });

  const body = (
    <>
      <span className="ss-cl-sv-name">
        <span className="ss-cl-dot" />
        {name}
      </span>
      <span className="ss-cl-sv-status">{status}</span>
    </>
  );

  return (
    <div ref={ref} className={cx('ss-cl-sv', `ss-group--${server.color}`, `is-${run.status}`, next && 'is-next')}>
      {run.status === 'pending' ? (
        <button type="button" className="ss-cl-sv-hit" title={t('changes.markRunOn', { server: name })} onClick={() => onSetRun(server.id, 'ran')}>
          {body}
        </button>
      ) : (
        <div className="ss-cl-sv-hit">{body}</div>
      )}
      <button
        type="button"
        className="ss-cl-sv-more"
        aria-label={t('changes.cell.menu', { server: name })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={14} />
      </button>
      {open && (
        <div className={cx('ss-cl-sv-menu', menuFrom === 'start' && 'is-start')}>
          <ContextMenu items={items} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** The detail of one change, in a drawer at the right: where it stands on each server, and its SQL, rollback and notes. */
export function ChangeDetail({ change, onClose, onSetRun, onUndoRun }: ChangeDetailProps) {
  const [tab, setTab] = useState<Tab>('sql');
  const warning = useMemo(() => analyzeSql(change.sql, change.engine), [change.sql, change.engine]);
  const sql = useMemo(() => highlightSql(change.sql), [change.sql]);
  const rollback = useMemo(() => highlightSql(change.rollback), [change.rollback]);
  const next = nextServer(change);
  const title = change.title || t('changes.untitled');

  return (
    <aside className="ss-cl-drawer" aria-label={`${seqLabel(change.seq)} ${title}`}>
      <div className="ss-cl-dh">
        <div className="ss-cl-sub">
          {change.key ? `${seqLabel(change.seq)} · ${change.key}` : seqLabel(change.seq)}
          <span className="ss-spacer" />
          <IconButton icon="x" size="sm" label={t('common.close')} onClick={onClose} />
        </div>
        <h2 className="ss-cl-h2">{title}</h2>
      </div>

      <div className="ss-cl-dbody">
        <dl className="ss-cl-kv">
          <dt>{t('changes.detail.date')}</dt>
          <dd>{dateTime(change.createdAt)}</dd>
          <dt>{t('field.database')}</dt>
          <dd>
            <span>{change.database}</span>
            {change.engine && <span className="ss-cl-kv-sub">· {change.engine}</span>}
          </dd>
          {change.branch && (
            <>
              <dt>{t('changes.detail.branch')}</dt>
              <dd>
                <span>{change.branch}</span>
                <button type="button" className="ss-cl-copy" aria-label={t('changes.detail.copyBranch')} title={t('changes.detail.copyBranch')} onClick={() => void copyText(change.branch)}>
                  <Icon name="copy" size={13} />
                </button>
              </dd>
            </>
          )}
          {change.pr && (
            <>
              <dt>{t('changes.detail.pr')}</dt>
              <dd>
                {change.pr.url ? (
                  <a href={change.pr.url} target="_blank" rel="noreferrer">{`${change.pr.repo}#${change.pr.number}`}</a>
                ) : (
                  <span>{`${change.pr.repo}#${change.pr.number}`}</span>
                )}
                <span className={cx('ss-cl-pr-dot', `is-${change.pr.state}`)} />
                <span className="ss-cl-kv-state">{t(`changes.pr.${change.pr.state}`)}</span>
              </dd>
            </>
          )}
        </dl>

        <div>
          <div className="ss-cl-cap">
            <span>{t('changes.detail.servers')}</span>
            <span>{t('changes.detail.hint')}</span>
          </div>
          <div className="ss-cl-servers">
            {SERVERS.map((s, i) => (
              <ServerCell
                key={s.id}
                change={change}
                server={s}
                menuFrom={i < 2 ? 'start' : 'end'}
                next={s.id === next}
                onSetRun={onSetRun}
                onUndoRun={onUndoRun}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="ss-cl-tabs" role="tablist">
            {TABS.map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={cx('ss-cl-tab', tab === id && 'is-on')} onClick={() => setTab(id)}>
                {tabName(id)}
              </button>
            ))}
          </div>
          {tab === 'sql' &&
            (change.sql ? (
              <pre className="ss-cl-code">
                <SqlTokens tokens={sql} />
              </pre>
            ) : (
              <div className="ss-cl-code is-empty">{t('changes.empty.sql')}</div>
            ))}
          {tab === 'rollback' &&
            (change.rollback ? (
              <pre className="ss-cl-code">
                <SqlTokens tokens={rollback} />
              </pre>
            ) : (
              <div className="ss-cl-code is-empty">{t('changes.empty.rollback')}</div>
            ))}
          {tab === 'notes' &&
            (change.notes ? (
              <div className="ss-cl-code ss-cl-notes">{change.notes}</div>
            ) : (
              <div className="ss-cl-code is-empty">{t('changes.empty.notes')}</div>
            ))}
          {tab === 'sql' && warning && (
            <div className={cx('ss-cl-note', warning.destructive ? 'is-danger' : 'is-warning')}>
              <Icon name="warning" size={13} />
              {warningText(warning)}
            </div>
          )}
        </div>
      </div>

      <div className="ss-cl-dfoot">
        <Button icon="copy" disabled={!change.sql} onClick={() => void copyExport(change.sql)}>
          {t('changes.copySql')}
        </Button>
        <span className="ss-spacer" />
        {next && (
          <Button variant="primary" icon="check" onClick={() => onSetRun(next, 'ran')}>
            {t('changes.markRunOn', { server: serverName(next) })}
          </Button>
        )}
      </div>
    </aside>
  );
}
