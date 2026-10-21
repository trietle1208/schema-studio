import { t } from '../core/i18n';
import type { RecordExportFormat } from '../core/records/export';
import { rowsText } from '../core/records/cells';
import { ContextMenu, type MenuItem } from './ContextMenu';

function items(onExport: (format: RecordExportFormat) => void): MenuItem[] {
  return [
    { icon: 'download', label: t('data.export.csv'), shortcut: '.csv', onSelect: () => onExport('csv') },
    { icon: 'download', label: t('data.export.json'), shortcut: '.json', onSelect: () => onExport('json') },
    { icon: 'download', label: t('data.export.insert'), shortcut: '.sql', onSelect: () => onExport('sql') },
  ];
}

export interface RecordExportMenuProps {
  /** How many rows the file will hold. */
  count: number;
  onExport: (format: RecordExportFormat) => void;
  onClose?: () => void;
}

/** CSV, JSON or INSERT for the rows a Data mode export is about. */
export function RecordExportMenu({ count, onExport, onClose }: RecordExportMenuProps) {
  return <ContextMenu label={t('data.export.label', { rows: rowsText(count) })} items={items(onExport)} onClose={onClose} />;
}
