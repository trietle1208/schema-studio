import { t } from '../core/i18n';
import type { RecordExportFormat } from '../core/records/export';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { RecordExportMenu } from './RecordExportMenu';
import { usePopover } from './usePopover';

export interface BulkActionBarProps {
  /** Rows selected. Draw the bar only while it is above zero. */
  count: number;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onExport?: (format: RecordExportFormat) => void;
  onDelete?: () => void;
  onClear?: () => void;
}

/** What can be done to the rows that are ticked in the grid; replaces the left tools of `DataToolbar`. */
export function BulkActionBar({ count, onEdit, onDuplicate, onExport, onDelete, onClear }: BulkActionBarProps) {
  const [exportOpen, setExportOpen, exportRef] = usePopover();
  return (
    <div className="ss-bulk" role="status">
      <span className="ss-bulk-count">
        <Icon name="check" size={14} />
        {t('selection.count', { count })}
      </span>
      <span className="ss-bulk-sep" aria-hidden />
      <div className="ss-bulk-actions">
        <Button size="sm" variant="ghost" icon="pencil" disabled={!onEdit} onClick={onEdit}>
          {t('selection.edit')}
        </Button>
        <Button size="sm" variant="ghost" icon="copy" disabled={!onDuplicate} onClick={onDuplicate}>
          {t('selection.duplicate')}
        </Button>
        <div className="ss-anchor" ref={exportRef}>
          <Button
            size="sm"
            variant="ghost"
            icon="download"
            active={exportOpen}
            disabled={!onExport}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen(!exportOpen)}
          >
            {t('selection.export')}
          </Button>
          {exportOpen && onExport && (
            <div className="ss-anchor-pop">
              <RecordExportMenu count={count} onExport={onExport} onClose={() => setExportOpen(false)} />
            </div>
          )}
        </div>
      </div>
      <span className="ss-bulk-sep" aria-hidden />
      <Button size="sm" variant="danger-ghost" icon="trash" kbd="⌫" disabled={!onDelete} onClick={onDelete}>
        {t('selection.delete', { count })}
      </Button>
      <IconButton icon="x" size="sm" label={t('selection.clear')} disabled={!onClear} onClick={onClear} />
    </div>
  );
}
