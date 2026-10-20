import { t } from '../core/i18n';
import { IconButton } from './IconButton';

export interface RowActionsProps {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

/** Floating Edit / Duplicate / Delete on a hovered grid row. */
export function RowActions({ onEdit, onDuplicate, onDelete }: RowActionsProps) {
  return (
    <div className="ss-row-actions" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <IconButton size="sm" icon="pencil" label={t('grid.action.edit')} disabled={!onEdit} onClick={onEdit} />
      <IconButton size="sm" icon="copy" label={t('grid.action.duplicate')} disabled={!onDuplicate} onClick={onDuplicate} />
      <span className="ss-row-actions-sep" aria-hidden />
      <IconButton size="sm" icon="trash" className="ss-row-actions-danger" label={t('grid.action.delete')} disabled={!onDelete} onClick={onDelete} />
    </div>
  );
}
