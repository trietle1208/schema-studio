import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Kbd } from '../components/Kbd';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { ENGINES } from '../core/schemaList';
import { validateSchemaName } from '../core/validate';
import { useSchemas } from '../db/useSchemas';
import { ecommerceSample } from '../store/schema';
import { useUiStore } from '../store/ui';
import { createNewSchema } from './schemaActions';

type Start = 'blank' | 'sample';

export function NewSchemaDialog() {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const schemas = useSchemas();
  const [name, setName] = useState('');
  const [engine, setEngine] = useState(ENGINES[0]);
  const [description, setDescription] = useState('');
  const [start, setStart] = useState<Start>('blank');
  // The name is not called invalid before it has been typed in.
  const [touched, setTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  const taken = (schemas ?? []).map((s) => s.name);
  const problem = validateSchemaName(name, taken);
  const sample = start === 'sample';

  const create = async () => {
    setTouched(true);
    if (problem || creating || !schemas) return;
    setCreating(true);
    // The sample's DDL is written for its own engine.
    const created = await createNewSchema({ name, description, engine: sample ? ecommerceSample.engine : engine, sample });
    // On success the dialog is closed, and this component gone.
    if (!created) setCreating(false);
  };

  // ⌘⏎ confirms from anywhere in the dialog. The handler is renewed on every render, so it sees the current fields.
  const confirm = useRef(create);
  useEffect(() => {
    confirm.current = create;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      void confirm.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void create();
  };

  return (
    <Modal
      title="New Schema"
      subtitle="Stored in this browser as v1. Every save after that adds a version."
      width={520}
      onClose={closeDialog}
      footerStart={
        <span className="ss-modal-foot-hint">
          <Kbd keys={['⌘', '⏎']} />
          to create
        </span>
      }
      footer={
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="primary" icon="plus" disabled={creating || (touched && !!problem)} onClick={() => void create()}>
            Create Schema
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
          <Field label="Schema name" error={touched ? problem : null}>
            <Input
              mono
              value={name}
              placeholder="my_schema"
              error={touched && !!problem}
              onChange={(e) => {
                setName(e.target.value);
                setTouched(true);
              }}
              spellCheck={false}
              autoComplete="off"
              data-autofocus
            />
          </Field>
          <Field label="Database">
            <Select
              value={sample ? ecommerceSample.engine : engine}
              onChange={setEngine}
              options={[...ENGINES]}
              disabled={sample}
              label="Database"
            />
          </Field>
        </div>
        <Field label="Description" aside="Optional">
          <Input
            value={description}
            placeholder="What the schema holds"
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Start with"
          hint={sample ? 'Five tables: users, orders, order_items, products and payments.' : 'No tables.'}
        >
          <SegmentedControl
            block
            value={start}
            onChange={(v) => setStart(v as Start)}
            options={[
              { value: 'blank', label: 'Blank schema', icon: 'plus' },
              { value: 'sample', label: 'Ecommerce sample', icon: 'database' },
            ]}
          />
        </Field>
        {/* Enter in a field submits the form. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
