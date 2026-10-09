import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Kbd } from '../components/Kbd';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select } from '../components/Select';
import { t } from '../core/i18n';
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
      title={t('action.newSchema')}
      subtitle={t('new.subtitle')}
      width={520}
      onClose={closeDialog}
      footerStart={
        <span className="ss-modal-foot-hint">
          <Kbd keys={['⌘', '⏎']} />
          {t('new.toCreate')}
        </span>
      }
      footer={
        <>
          <Button onClick={closeDialog}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="plus" disabled={creating || (touched && !!problem)} onClick={() => void create()}>
            {t('new.create')}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
          <Field label={t('field.schemaName')} error={touched ? problem : null}>
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
          <Field label={t('field.database')}>
            <Select
              value={sample ? ecommerceSample.engine : engine}
              onChange={setEngine}
              options={[...ENGINES]}
              disabled={sample}
              label={t('field.database')}
            />
          </Field>
        </div>
        <Field label={t('new.description')} aside={t('new.optional')}>
          <Input
            value={description}
            placeholder={t('new.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field
          label={t('new.startWith')}
          hint={sample ? t('new.sampleHint') : t('new.blankHint')}
        >
          <SegmentedControl
            block
            value={start}
            onChange={(v) => setStart(v as Start)}
            options={[
              { value: 'blank', label: t('new.blank'), icon: 'plus' },
              { value: 'sample', label: t('new.sample'), icon: 'database' },
            ]}
          />
        </Field>
        {/* Enter in a field submits the form. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
