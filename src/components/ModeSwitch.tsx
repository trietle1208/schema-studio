import { t } from '../core/i18n';
import type { WorkspaceMode } from '../core/routes';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

export interface ModeSwitchProps {
  value: WorkspaceMode;
  onChange?: (mode: WorkspaceMode) => void;
  /** A schema without tables has no data to show. */
  dataDisabled?: boolean;
}

/** The switch in the toolbar between Diagram, Data and Query. */
export function ModeSwitch({ value, onChange, dataDisabled }: ModeSwitchProps) {
  // Built here, not at module level, so the labels follow the language of the app.
  const options: SegmentedOption[] = [
    { value: 'diagram', label: t('mode.diagram') },
    { value: 'data', label: t('mode.data'), disabled: dataDisabled, title: dataDisabled ? t('mode.dataNoTables') : undefined },
    { value: 'query', label: t('mode.query') },
  ];
  return <SegmentedControl options={options} value={value} onChange={(mode) => onChange?.(mode as WorkspaceMode)} />;
}
