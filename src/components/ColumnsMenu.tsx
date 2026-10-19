import { t } from '../core/i18n';
import type { Column } from '../core/model';
import { Button } from './Button';
import { Checkbox } from './Checkbox';

export interface ColumnsMenuProps {
  columns: readonly Pick<Column, 'name' | 'type'>[];
  /** The names of the columns that are left out. */
  hidden: readonly string[];
  /** Hears the names that are left out after a change. */
  onHidden: (hidden: string[]) => void;
}

/** A list of the columns of a table to tick on and off, as the data toolbar and the query Builder offer it. At least one stays on. */
export function ColumnsMenu({ columns, hidden, onHidden }: ColumnsMenuProps) {
  const shown = columns.length - hidden.length;
  const toggle = (name: string, on: boolean) => onHidden(on ? hidden.filter((x) => x !== name) : [...hidden, name]);
  return (
    <div className="ss-menu ss-dt-pop" role="group" aria-label={t('columnsMenu.label')}>
      <div className="ss-menu-label">{t('columnsMenu.count', { shown, total: columns.length })}</div>
      {columns.map((c) => {
        const on = !hidden.includes(c.name);
        return (
          <div key={c.name} className="ss-dt-col">
            <Checkbox checked={on} disabled={on && shown === 1} onChange={(v) => toggle(c.name, v)} label={<span className="ss-mono" style={{ fontSize: 12 }}>{c.name}</span>} />
            <span className="ss-dt-col-type">{c.type}</span>
          </div>
        );
      })}
      <div className="ss-menu-sep" role="separator" />
      <div className="ss-dt-form-foot">
        <Button variant="ghost" size="sm" disabled={!hidden.length} onClick={() => onHidden([])}>
          {t('columnsMenu.showAll')}
        </Button>
      </div>
    </div>
  );
}
