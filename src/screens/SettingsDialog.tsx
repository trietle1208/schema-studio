import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { SegmentedControl } from '../components/SegmentedControl';
import { LOCALES, parseLocale, t } from '../core/i18n';
import { notationOptions, parseNotation } from '../core/notation';
import { parseTheme, themeOptions } from '../core/theme';
import { useSettingsStore } from '../store/settings';
import { useUiStore } from '../store/ui';

/** The settings of the app itself. Each one takes effect as it is changed, so there is nothing to confirm. */
export function SettingsDialog() {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const notation = useSettingsStore((s) => s.notation);
  const setNotation = useSettingsStore((s) => s.setNotation);

  return (
    <Modal
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      width={440}
      onClose={closeDialog}
      footer={
        <Button onClick={closeDialog} kbd="Esc" data-autofocus>
          {t('common.close')}
        </Button>
      }
    >
      <div>
        <div className="ss-caption" style={{ marginBottom: 8 }}>
          {t('settings.appearance')}
        </div>
        <div className="ss-row" style={{ gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('field.theme')}</div>
            <div className="ss-faint" style={{ fontSize: 12 }}>
              {t('settings.themeHint')}
            </div>
          </div>
          <SegmentedControl value={theme} onChange={(value) => setTheme(parseTheme(value))} options={themeOptions()} />
        </div>
        <div className="ss-row" style={{ gap: 16, marginTop: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('settings.language')}</div>
            <div className="ss-faint" style={{ fontSize: 12 }}>
              {t('settings.languageHint')}
            </div>
          </div>
          {/* Each language is called what it calls itself, so that it is found by someone who reads no other. */}
          <SegmentedControl value={locale} onChange={(value) => setLocale(parseLocale(value))} options={[...LOCALES]} />
        </div>
        <div className="ss-caption" style={{ margin: '20px 0 8px' }}>
          {t('settings.diagram')}
        </div>
        <div className="ss-row" style={{ gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{t('settings.notation')}</div>
            <div className="ss-faint" style={{ fontSize: 12 }}>
              {t('settings.notationHint')}
            </div>
          </div>
          <SegmentedControl value={notation} onChange={(value) => setNotation(parseNotation(value))} options={notationOptions()} />
        </div>
      </div>
    </Modal>
  );
}
