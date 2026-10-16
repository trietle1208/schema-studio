import { ConfirmDialog } from '../components/Modal';
import { rich } from '../components/rich';
import { Alert } from '../components/Toast';
import { t } from '../core/i18n';
import type { DeleteEffect, DeletePlan } from '../core/records/delete';
import { rowsText } from '../core/records/cells';

export interface DeleteRecordsDialogProps {
  table: string;
  /** How many rows are asked to go. */
  count: number;
  /** What it does to the rows of other tables; a plan that is blocked cannot be confirmed. */
  plan: DeletePlan;
  onConfirm: () => void;
  onCancel: () => void;
}

/** What a delete does through one foreign key, as an alert: a warning when it goes on, an error when it is refused. */
function EffectAlert({ effect }: { effect: DeleteEffect }) {
  const reference = `${effect.table}.${effect.column}`;
  const rows = rowsText(effect.count);
  if (effect.blocked) {
    return (
      <Alert tone="error" title={t('records.delete.blocked.title', { count: effect.count, rows, table: effect.table })}>
        {effect.rule === 'SET NULL' ? t('records.delete.blocked.notNull', { reference }) : t('records.delete.blocked.rule', { reference, rule: effect.rule })}
      </Alert>
    );
  }
  return effect.rule === 'CASCADE' ? (
    <Alert tone="warn" title={t('records.delete.cascade.title', { rows, table: effect.table })}>
      {t('records.delete.cascade.body', { reference })}
    </Alert>
  ) : (
    <Alert tone="warn" title={t('records.delete.setNull.title', { reference, rows })}>
      {t('records.delete.setNull.body', { reference })}
    </Alert>
  );
}

/** Asks before rows are deleted, and says what follows for the rows that point at them. */
export function DeleteRecordsDialog({ table, count, plan, onConfirm, onCancel }: DeleteRecordsDialogProps) {
  return (
    <ConfirmDialog
      title={t('records.delete.title', { count, table })}
      danger
      confirmLabel={t('records.delete.confirm', { count })}
      confirmDisabled={plan.blocked}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div style={{ color: 'var(--ink-2)' }}>
        {rich('records.delete.body', {
          rows: rowsText(count),
          table: (
            <code className="ss-mono" style={{ color: 'var(--ink-1)' }}>
              {table}
            </code>
          ),
        })}
      </div>
      {plan.effects.map((effect) => (
        <EffectAlert key={`${effect.table}.${effect.column}`} effect={effect} />
      ))}
    </ConfirmDialog>
  );
}
