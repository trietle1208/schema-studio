import { t } from '../core/i18n';
import { Button } from './Button';
import { IconButton } from './IconButton';

export interface SelectionBarProps {
  /** Rows selected. Draw the bar only while it is above zero. */
  count: number;
  // Each button stays disabled without a handler.
  onCopy?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onClear?: () => void;
}

/** What can be done to the rows that are ticked in the grid. */
export function SelectionBar({ count, onCopy, onExport, onDelete, onClear }: SelectionBarProps) {
  return (
    <div className="ss-selbar" role="status">
      <span className="ss-selbar-count">{t('selection.count', { count })}</span>
      <Button size="sm" icon="code" disabled={!onCopy} onClick={onCopy}>
        {t('selection.copy')}
      </Button>
      <Button size="sm" icon="download" disabled={!onExport} onClick={onExport}>
        {t('selection.export')}
      </Button>
      <Button size="sm" variant="danger-ghost" icon="trash" kbd="⌫" disabled={!onDelete} onClick={onDelete}>
        {t('selection.delete', { count })}
      </Button>
      <span className="ss-spacer" />
      <IconButton icon="x" size="sm" label={t('selection.clear')} disabled={!onClear} onClick={onClear} />
    </div>
  );
}
