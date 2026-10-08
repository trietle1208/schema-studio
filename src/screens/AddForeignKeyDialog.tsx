import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Kbd } from '../components/Kbd';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { referencingType } from '../core/datatypes';
import { suggestForeignKey } from '../core/infer';
import {
  DEFAULT_ON_DELETE,
  freeColumns,
  ON_DELETE_ACTIONS,
  qualifiedName,
  referenceColumnName,
  referenceTargets,
} from '../core/relations';
import { validateColumns } from '../core/validate';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';

/** What the Column select holds for a column that is yet to be added. No column it lists has an empty name. */
const NEW_COLUMN = '';

export interface AddForeignKeyDialogProps {
  /** The name of the table that gets the foreign key. */
  table: string;
}

/**
 * Adds a foreign key to a table: on one of its columns that has none, or on a new column that is
 * called after the table it references and gets the type of that table's primary key. It opens on
 * the foreign key the names of the columns point to, when they point to one.
 */
export function AddForeignKeyDialog({ table: name }: AddForeignKeyDialogProps) {
  const tables = useSchemaStore((s) => s.tables);
  const addForeignKey = useSchemaStore((s) => s.addForeignKey);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const table = tables.find((t) => t.name === name);
  const targets = table ? referenceTargets(table, tables) : [];

  const [suggested] = useState(() => (table ? suggestForeignKey(table, tables) : null));
  const [column, setColumn] = useState(suggested?.from.column ?? NEW_COLUMN);
  const [reference, setReference] = useState(suggested ? qualifiedName(suggested.to) : '');
  /** The name typed for a new column; null while it follows the table that is referenced. */
  const [typed, setTyped] = useState<string | null>(null);
  const [onDelete, setOnDelete] = useState(DEFAULT_ON_DELETE);

  const to = targets.find((t) => qualifiedName(t) === reference) ?? targets[0];
  const adds = column === NEW_COLUMN;
  const referenced = to && tables.find((t) => t.name === to.table)?.columns.find((c) => c.name === to.column);
  const type = referenced ? referencingType(referenced.type) : '';
  const newName = typed ?? (to ? referenceColumnName(to) : '');
  const problem =
    table && adds
      ? (validateColumns({ ...table, columns: [...table.columns, { name: newName, type }] })[table.columns.length] ?? null)
      : null;

  const add = () => {
    if (!table || !to || problem) return;
    if (addForeignKey({ table: table.name, column: adds ? newName : column }, to, onDelete)) closeDialog();
  };

  // ⌘⏎ confirms from anywhere in the dialog. The handler is renewed on every render, so it sees the current fields.
  const confirm = useRef(add);
  useEffect(() => {
    confirm.current = add;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      confirm.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!table || !to) return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    add();
  };

  return (
    <Modal
      title="Add foreign key"
      subtitle={`From a column of ${table.schema || 'public'}.${table.name} to the primary key of another table.`}
      icon="link"
      width={520}
      onClose={closeDialog}
      footerStart={
        <span className="ss-modal-foot-hint">
          <Kbd keys={['⌘', '⏎']} />
          to add
        </span>
      }
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          {/* Focus starts on the name of a new column; without one it starts here, where Enter adds. */}
          <Button variant="primary" icon="link" disabled={!!problem} onClick={add} data-autofocus>
            Add foreign key
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Column">
            <Select
              mono
              value={column}
              onChange={setColumn}
              label="Column"
              options={[
                ...freeColumns(table)
                  .filter((c) => c.name.trim())
                  .map((c) => c.name),
                { value: NEW_COLUMN, label: 'New column' },
              ]}
            />
          </Field>
          <Field label="References">
            <Select mono value={qualifiedName(to)} onChange={setReference} label="References" options={targets.map(qualifiedName)} />
          </Field>
        </div>
        {adds && (
          <Field label="Column name" error={problem} hint={`Added as ${type}, the type that references ${qualifiedName(to)}.`}>
            <Input
              mono
              value={newName}
              placeholder="column_name"
              error={!!problem}
              onChange={(e) => setTyped(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-label="Column name"
              data-autofocus
            />
          </Field>
        )}
        <Field label="On delete">
          <SegmentedControl
            block
            value={onDelete}
            onChange={(v) => {
              const action = ON_DELETE_ACTIONS.find((a) => a === v);
              if (action) setOnDelete(action);
            }}
            options={ON_DELETE_ACTIONS.map((a) => ({ value: a, label: a }))}
          />
        </Field>
        {/* Enter in a field submits the form. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
