import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { cx } from '../components/cx';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { rich } from '../components/rich';
import { backupBefore, defaultSelection, deployFileName, deployRows, deployScript, scriptLines } from '../core/changes/deploy';
import { seqLabel, serverOf, type ServerId } from '../core/changes/model';
import { flagText, flagTone, serverName } from '../core/changes/text';
import { t } from '../core/i18n';
import type { ChangeRecord } from '../db/db';
import { downloadScript, markDeployed } from './changeActions';
import { copyExport } from './exportActions';

export interface DeployDialogProps {
  /** Every change of the log. */
  changes: readonly ChangeRecord[];
  database: string;
  server: ServerId;
  /** The moment that dates the file of the script. */
  now: number;
  onClose: () => void;
}

/**
 * The script that takes `server` up to date, to be run by hand: the changes of `database` that wait
 * there, in the order they were written, each of them checked or not. Once the script was run, the
 * checked changes are marked here.
 */
export function DeployDialog({ changes, database, server, now, onClose }: DeployDialogProps) {
  const rows = useMemo(() => deployRows(changes, database, server), [changes, database, server]);
  const [selected, setSelected] = useState(() => defaultSelection(rows));
  const [marking, setMarking] = useState(false);

  const script = useMemo(() => deployScript(rows, selected), [rows, selected]);
  const backup = backupBefore(rows, selected);
  const checked = rows.filter((r) => selected.has(r.change.seq));
  const fileName = deployFileName(database, server, now);

  const toggle = (seq: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(seq)) next.add(seq);
      return next;
    });

  const mark = async () => {
    if (checked.length === 0 || marking) return;
    setMarking(true);
    const written = await markDeployed(
      checked.map((r) => r.change.seq),
      server,
    );
    if (written) onClose();
    else setMarking(false);
  };

  // ⌘⏎ marks, as it confirms any other dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      void mark();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Modal
      className="ss-cl-deploy"
      title={t('changes.deploy.title', { server: serverName(server) })}
      subtitle={rich('changes.deploy.subtitle', {
        database: <span className="ss-mono">{database}</span>,
        n: checked.length,
        count: rows.length,
      })}
      icon="rocket"
      iconStyle={{ background: 'transparent', color: `var(--group-${serverOf(server).color})`, width: 20, height: 20 }}
      width={620}
      onClose={onClose}
      footerStart={<span className="ss-modal-foot-hint">{t('changes.deploy.hint')}</span>}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="check" disabled={checked.length === 0 || marking} onClick={() => void mark()}>
            {t('changes.deploy.mark', { count: checked.length })}
          </Button>
        </>
      }
    >
      <div className="ss-cl-box">
        {rows.map(({ change, flag }) => {
          const on = selected.has(change.seq);
          return (
            <label key={change.seq} className={cx('ss-check', 'ss-cl-it', !on && 'is-off')}>
              <input type="checkbox" checked={on} aria-label={t('changes.deploy.include', { seq: seqLabel(change.seq) })} onChange={() => toggle(change.seq)} />
              <span className="ss-check-box">{on && <Icon name="check" size={11} strokeWidth={3} />}</span>
              <span className="ss-cl-seq">{seqLabel(change.seq)}</span>
              <span className="ss-cl-it-title">{change.title || t('changes.untitled')}</span>
              {flag ? (
                <span className={cx('ss-cl-flag', `is-${flagTone(flag)}`)}>
                  {flagTone(flag) !== 'muted' && <Icon name="warning" size={12} />}
                  {flagText(flag)}
                </span>
              ) : (
                <span />
              )}
            </label>
          );
        })}
        <div className="ss-cl-sline">
          <Icon name="download" size={14} />
          <span className="ss-cl-sline-f">{fileName}</span>
          <span className="ss-cl-sline-n">{t('changes.deploy.lines', { count: scriptLines(script) })}</span>
          <span className="ss-spacer" />
          <Button variant="ghost" size="sm" icon="copy" disabled={!script} onClick={() => void copyExport(script)}>
            {t('common.copy')}
          </Button>
          <Button variant="ghost" size="sm" icon="download" disabled={!script} onClick={() => downloadScript(fileName, `${script}\n`)}>
            {t('changes.deploy.download')}
          </Button>
        </div>
      </div>
      {backup && (
        <div className="ss-cl-note is-danger">
          <Icon name="warning" size={13} />
          <span>
            {rich('changes.deploy.backup', {
              table: <span className="ss-mono ss-cl-backup">{backup.table}</span>,
              seq: seqLabel(backup.seq),
            })}
          </span>
        </div>
      )}
    </Modal>
  );
}
