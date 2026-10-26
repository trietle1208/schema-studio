import { t } from '../i18n';
import type { ChangeGroup } from './group';
import type { DeployFlag } from './deploy';
import type { RunStatus, ServerId } from './model';

// The words of the change log, in the language of the app.

export const serverName = (id: ServerId): string => t(`changes.server.${id}`);

export const statusName = (status: RunStatus): string => t(`changes.status.${status}`);

export const groupName = (group: ChangeGroup): string => t(`changes.group.${group}`);

/** How a flag of a deploy reads: "drops a table", "failed on Staging". */
export function flagText(flag: DeployFlag): string {
  if (flag.kind === 'drop-table') return t('changes.flag.dropTable');
  if (flag.kind === 'drop-column') return t('changes.flag.dropColumn');
  if (flag.kind === 'rewrite') return t('changes.flag.rewrite');
  if (flag.kind === 'failed') return t('changes.flag.failed', { server: serverName(flag.server) });
  return t('changes.flag.prOpen');
}

/** How loud a flag is: a drop is danger, a rewrite or a failure is a warning, an open pull request is only a note. */
export function flagTone(flag: DeployFlag): 'danger' | 'warning' | 'muted' {
  if (flag.kind === 'drop-table' || flag.kind === 'drop-column') return 'danger';
  return flag.kind === 'pr-open' ? 'muted' : 'warning';
}

const two = (n: number) => String(n).padStart(2, '0');

/** The day a run happened, as the server cells show it: `21/10`. */
export function runDay(at: number): string {
  const day = new Date(at);
  return `${two(day.getDate())}/${two(day.getMonth() + 1)}`;
}
