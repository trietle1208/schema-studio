import { t } from '../core/i18n';
import type { Version } from '../core/model';
import { Badge } from './Badge';
import { cx } from './cx';
import { Icon } from './Icon';

export interface VersionListProps {
  /** Newest first. */
  versions: Version[];
  /** The `version` of the selected one: `v12`. */
  selected?: string;
  onSelect?: (version: string) => void;
}

export function VersionList({ versions, selected, onSelect }: VersionListProps) {
  return (
    <div className="ss-vlist" role="listbox" aria-label={t('history.list')}>
      {versions.map((v) => (
        <button
          key={v.version}
          type="button"
          role="option"
          aria-selected={selected === v.version}
          className={cx('ss-ver', v.current && 'is-current', selected === v.version && 'is-selected')}
          onClick={() => onSelect?.(v.version)}
        >
          <span className="ss-ver-rail">
            <span className="ss-ver-dot" />
          </span>
          <span className="ss-ver-body">
            <span className="ss-ver-top">
              <span className="ss-ver-num">{v.version}</span>
              {v.current && (
                <Badge tone="accent" sans>
                  {t('version.current')}
                </Badge>
              )}
              {v.note && <Icon name="file" size={12} className="ss-faint" label={t('history.note')} />}
              <span className="ss-ver-time">{v.time}</span>
            </span>
            <span className="ss-ver-msg" style={{ display: 'block' }}>
              {v.message}
            </span>
            <span className="ss-ver-stats">
              {v.added ? <span className="a">{`+${v.added}`}</span> : null}
              {v.modified ? <span className="m">{`~${v.modified}`}</span> : null}
              {v.removed ? <span className="r">{`−${v.removed}`}</span> : null}
              {v.author && <span className="ss-faint">{v.author}</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
