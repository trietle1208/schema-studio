import { ResizeHandle } from '../components/ResizeHandle';
import { t } from '../core/i18n';
import { PANELS, type Panel } from '../core/panels';
import { useSettingsStore } from '../store/settings';

/**
 * The handle of the sidebar or of the inspector: place it right after the sidebar, or right before
 * the inspector. The width it is dragged to is kept in this browser.
 */
export function PanelHandle({ panel }: { panel: Panel }) {
  const width = useSettingsStore((s) => s.panels[panel]);
  const setPanelWidth = useSettingsStore((s) => s.setPanelWidth);
  const { initial, min, max } = PANELS[panel];
  return (
    <ResizeHandle
      label={panel === 'sidebar' ? t('panel.sidebar') : t('panel.inspector')}
      edge={panel === 'sidebar' ? 'right' : 'left'}
      width={width}
      min={min}
      max={max}
      onResize={(w) => setPanelWidth(panel, w)}
      onReset={() => setPanelWidth(panel, initial)}
    />
  );
}
