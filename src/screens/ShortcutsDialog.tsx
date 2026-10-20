import { Button } from '../components/Button';
import { Kbd } from '../components/Kbd';
import { Modal } from '../components/Modal';
import { t } from '../core/i18n';
import { useUiStore } from '../store/ui';

type ShortcutRow = { label: string; keys: string[] };

function Group({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div className="ss-sc-group">
      <div className="ss-caption">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="ss-sc-row">
          <span>{row.label}</span>
          <Kbd keys={row.keys} />
        </div>
      ))}
    </div>
  );
}

/** Lists the keyboard shortcuts that work across the app. */
export function ShortcutsDialog() {
  const closeDialog = useUiStore((s) => s.closeDialog);

  return (
    <Modal
      title={t('shortcuts.title')}
      subtitle={t('shortcuts.subtitle')}
      width={440}
      onClose={closeDialog}
      footer={
        <Button onClick={closeDialog} kbd="Esc" data-autofocus>
          {t('common.close')}
        </Button>
      }
    >
      <div className="ss-sc-list">
        <Group
          title={t('shortcuts.group.general')}
          rows={[
            { label: t('shortcuts.newSchema'), keys: ['⌘', 'N'] },
            { label: t('shortcuts.import'), keys: ['⌘', 'I'] },
            { label: t('shortcuts.settings'), keys: ['⌘', ','] },
            { label: t('shortcuts.shortcuts'), keys: ['⌘', '/'] },
            { label: t('shortcuts.toggleSidebar'), keys: ['⌘', 'B'] },
          ]}
        />
        <Group
          title={t('shortcuts.group.edit')}
          rows={[
            { label: t('shortcuts.save'), keys: ['⌘', 'S'] },
            { label: t('shortcuts.undo'), keys: ['⌘', 'Z'] },
            { label: t('shortcuts.redo'), keys: ['⇧', '⌘', 'Z'] },
            { label: t('shortcuts.search'), keys: ['⌘', 'K'] },
            { label: t('shortcuts.history'), keys: ['⌘', 'H'] },
            { label: t('shortcuts.duplicate'), keys: ['⌘', 'D'] },
            { label: t('shortcuts.rename'), keys: ['F2'] },
            { label: t('shortcuts.delete'), keys: ['⌫'] },
            { label: t('shortcuts.cancel'), keys: ['Esc'] },
            { label: t('shortcuts.addColumn'), keys: ['⌘', '⏎'] },
            { label: t('shortcuts.copyCreate'), keys: ['⇧', '⌘', 'C'] },
          ]}
        />
        <Group
          title={t('shortcuts.group.diagram')}
          rows={[
            { label: t('shortcuts.zoomIn'), keys: ['⌘', '+'] },
            { label: t('shortcuts.zoomOut'), keys: ['⌘', '−'] },
            { label: t('shortcuts.zoomReset'), keys: ['⌘', '0'] },
            { label: t('shortcuts.fit'), keys: ['⇧', '1'] },
            { label: t('shortcuts.arrange'), keys: ['⇧', 'A'] },
          ]}
        />
      </div>
    </Modal>
  );
}
