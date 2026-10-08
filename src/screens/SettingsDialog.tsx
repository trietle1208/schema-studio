import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { parseTheme, THEMES } from '../core/theme';
import { useSettingsStore } from '../store/settings';
import { useUiStore } from '../store/ui';

const THEME_OPTIONS = THEMES.map((t) => ({ value: t.value, label: t.label }));

/** The settings of the app itself. Each one takes effect as it is changed, so there is nothing to confirm. */
export function SettingsDialog() {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <Modal
      title="Settings"
      subtitle="Kept in this browser"
      width={440}
      onClose={closeDialog}
      footer={
        <Button onClick={closeDialog} kbd="Esc" data-autofocus>
          Close
        </Button>
      }
    >
      <div>
        <div className="ss-caption" style={{ marginBottom: 8 }}>
          Appearance
        </div>
        <div className="ss-row" style={{ gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>Theme</div>
            <div className="ss-faint" style={{ fontSize: 12 }}>
              Dark is the default. A change applies at once.
            </div>
          </div>
          <SegmentedControl value={theme} onChange={(value) => setTheme(parseTheme(value))} options={THEME_OPTIONS} />
        </div>
      </div>
    </Modal>
  );
}
