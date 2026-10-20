import { t } from '../core/i18n';
import type { RecordFilter } from '../core/records/filter';
import { Button } from './Button';
import { Icon } from './Icon';

export interface FilterChipsProps {
  filters: readonly RecordFilter[];
  onRemove?: (index: number) => void;
  onClear?: () => void;
}

function sqlLiteral(v: unknown): string {
  if (v == null) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function filterText(f: RecordFilter): string {
  return `${f.column} ${f.op}${f.value !== undefined ? ` ${sqlLiteral(f.value)}` : ''}`;
}

/** The filters that are on, as chips under the data toolbar. */
export function FilterChips({ filters, onRemove, onClear }: FilterChipsProps) {
  if (!filters.length) return null;
  return (
    <div className="ss-fchips" role="group" aria-label={t('dataToolbar.filters')}>
      {filters.map((f, i) => (
        <span key={i} className="ss-fchip" title={filterText(f)}>
          <span className="ss-fchip-text">
            <span>{f.column}</span> <span className={/^[A-Z]/.test(f.op) ? 'ss-fchip-kw' : 'ss-fchip-op'}>{f.op}</span>
            {f.value !== undefined && (
              <>
                {' '}
                <span className={typeof f.value === 'string' ? 'ss-fchip-str' : 'ss-fchip-num'}>{sqlLiteral(f.value)}</span>
              </>
            )}
          </span>
          <button type="button" className="ss-fchip-x" aria-label={t('dataToolbar.removeFilter', { filter: filterText(f) })} onClick={() => onRemove?.(i)}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear}>
        {t('dataToolbar.clearFilters')}
      </Button>
    </div>
  );
}
