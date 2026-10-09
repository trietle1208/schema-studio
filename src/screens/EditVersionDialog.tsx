import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Input } from '../components/Input';
import { Kbd } from '../components/Kbd';
import { Modal } from '../components/Modal';
import { t } from '../core/i18n';
import { changeMessage, versionEntries, versionLabel, type VersionEntry } from '../core/versions';
import { MAX_VERSION_MESSAGE, MAX_VERSION_NOTE } from '../db/schemas';
import { useVersions } from '../db/useSchemas';
import { useSchemaStore } from '../store/schema';
import { useUiStore } from '../store/ui';
import { editVersion } from './versionActions';

export interface EditVersionDialogProps {
  /** The version to rename and write a note on. */
  version: number;
}

/** Waits for the versions of the open schema, then shows the one that is edited. */
export function EditVersionDialog({ version }: EditVersionDialogProps) {
  const id = useSchemaStore((s) => s.id);
  const stored = useVersions(id);
  const entry = useMemo(() => versionEntries(stored ?? []).find((e) => e.version === version), [stored, version]);
  if (!entry) return null;
  return <EditVersionForm entry={entry} />;
}

function EditVersionForm({ entry }: { entry: VersionEntry }) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const [message, setMessage] = useState(entry.message);
  const [note, setNote] = useState(entry.note ?? '');
  const label = versionLabel(entry.version);

  const save = () => void editVersion(entry.version, { message, note });

  // ⌘⏎ saves from anywhere in the dialog. The handler is renewed on every render, so it sees the current fields.
  const confirm = useRef(save);
  useEffect(() => {
    confirm.current = save;
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

  return (
    <Modal
      title={t('version.edit.title', { version: label })}
      subtitle={t('version.edit.subtitle')}
      width={520}
      onClose={closeDialog}
      footerStart={
        <span className="ss-modal-foot-hint">
          <Kbd keys={['⌘', '⏎']} />
          {t('version.edit.toSave')}
        </span>
      }
      footer={
        <>
          <Button onClick={closeDialog}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="check" onClick={save}>
            {t('version.edit.save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{ display: 'contents' }}
      >
        <Field label={t('version.edit.name')} hint={t('version.edit.nameHint', { version: label, changes: changeMessage(entry) })}>
          <Input
            value={message}
            maxLength={MAX_VERSION_MESSAGE}
            placeholder={t('version.edit.namePlaceholder')}
            onChange={(e) => setMessage(e.target.value)}
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <Field label={t('version.edit.note')} aside={t('new.optional')}>
          <textarea
            className="ss-input"
            rows={5}
            value={note}
            maxLength={MAX_VERSION_NOTE}
            placeholder={t('version.edit.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {/* Enter in the name submits the form. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
