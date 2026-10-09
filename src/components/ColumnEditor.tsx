import { setNullable, setPrimaryKey } from '../core/columns';
import { t } from '../core/i18n';
import type { Column, Table } from '../core/model';
import {
  declareReference,
  DEFAULT_ON_DELETE,
  ON_DELETE_ACTIONS,
  qualifiedName,
  referenceTargets,
  setOnDelete,
  setReference,
} from '../core/relations';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Field } from './Field';
import { Input } from './Input';
import { SegmentedControl } from './SegmentedControl';
import { Select } from './Select';

export interface ColumnEditorProps {
  column: Column;
  table: Table;
  tables: Table[];
  /** `field` names a text field being typed into, so the caller can treat the keystrokes as one edit. */
  onChange: (column: Column, field?: string) => void;
  onDelete?: () => void;
}

export function ColumnEditor({ column: c, table, tables, onChange, onDelete }: ColumnEditorProps) {
  const targets = referenceTargets(table, tables);
  // A reference that is not another table's primary key is still listed, so the select shows what is stored.
  if (c.fk && !targets.some((r) => r.table === c.fk?.table && r.column === c.fk?.column)) {
    targets.push({ table: c.fk.table, column: c.fk.column });
  }
  const onDeleteAction = c.fk?.onDelete ?? DEFAULT_ON_DELETE;

  return (
    <div className="ss-coledit" onClick={(e) => e.stopPropagation()}>
      <Field label={t('column.default')} className="ss-span1">
        <Input
          mono
          size="sm"
          value={c.default || ''}
          placeholder={c.nullable ? 'NULL' : t('column.defaultNone')}
          spellCheck={false}
          onChange={(e) => onChange({ ...c, default: e.target.value }, 'default')}
        />
      </Field>
      <Field label={t('column.references')}>
        <Select
          mono
          size="sm"
          value={c.fk ? qualifiedName(c.fk) : ''}
          options={[{ value: '', label: t('column.noReference') }, ...targets.map((r) => ({ value: qualifiedName(r), label: qualifiedName(r) }))]}
          onChange={(v) => onChange(setReference(c, targets.find((r) => qualifiedName(r) === v) ?? null))}
        />
      </Field>
      {c.fk && !c.fk.inferred && (
        <Field label={t('column.onDelete')} className="ss-span2">
          <SegmentedControl
            block
            value={onDeleteAction}
            onChange={(v) => {
              const action = ON_DELETE_ACTIONS.find((a) => a === v);
              if (action) onChange(setOnDelete(c, action));
            }}
            options={ON_DELETE_ACTIONS.map((a) => ({ value: a, label: a }))}
          />
        </Field>
      )}
      {c.fk?.inferred && (
        // An inferred reference is only a line on the canvas until it is made a foreign key.
        <div className="ss-span2 ss-coledit-foot">
          <span className="ss-faint" style={{ fontSize: 11 }}>
            {t('column.inferredNote')}
          </span>
          <Button size="sm" icon="link" onClick={() => onChange(declareReference(c))}>
            {t('column.makeForeignKey')}
          </Button>
        </div>
      )}
      <div className="ss-span2 ss-coledit-checks">
        <Checkbox label={t('flag.nullable')} checked={c.nullable} disabled={c.pk} onChange={(v) => onChange(setNullable(c, v))} />
        <Checkbox label={t('flag.primaryKey')} checked={c.pk} onChange={(v) => onChange(setPrimaryKey(c, v))} />
        <Checkbox label={t('flag.unique')} checked={c.unique} onChange={(v) => onChange({ ...c, unique: v })} />
      </div>
      <Field label={t('field.comment')} className="ss-span2">
        <Input
          size="sm"
          value={c.comment || ''}
          placeholder={t('column.commentPlaceholder')}
          onChange={(e) => onChange({ ...c, comment: e.target.value }, 'comment')}
        />
      </Field>
      <div className="ss-span2 ss-coledit-foot">
        <span className="ss-faint" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {`ALTER TABLE ${table.name} …`}
        </span>
        <Button variant="danger-ghost" size="sm" icon="trash" onClick={onDelete}>
          {t('column.delete')}
        </Button>
      </div>
    </div>
  );
}
