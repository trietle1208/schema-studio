import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatNumber, t } from '../core/i18n';
import type { Column, Table } from '../core/model';
import type { RecordValue, Row } from '../core/records';
import { rowsText } from '../core/records/cells';
import { MOMENTS, validMoment, type Moment } from '../core/records/fields';
import { labelColumn } from '../core/records/record';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { usePopover } from './usePopover';

/** The input the browser opens its own picker with, by what the moment holds. */
const PICKER: Record<Moment, string> = { timestamp: 'datetime-local', date: 'date', time: 'time' };

export interface MomentInputProps {
  column: Column;
  kind: Moment;
  value: RecordValue | undefined;
  placeholder?: string;
  error?: boolean;
  onChange: (value: string) => void;
}

/** A date and time typed in the format SQL writes, with the picker of the browser behind the clock. */
export function MomentInput({ column, kind, value, placeholder, error, onChange }: MomentInputProps) {
  const pick = useRef<HTMLInputElement>(null);
  const text = value == null ? '' : String(value);
  const native = text && validMoment(kind, text) ? (kind === 'timestamp' ? text.replace(' ', 'T') : text) : '';

  const open = () => {
    const el = pick.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };
  const chosen = (v: string) => {
    if (!v) return;
    let out = kind === 'timestamp' ? v.replace('T', ' ') : v;
    // The picker leaves out the seconds when they are zero.
    if (/(^|[ T])\d{2}:\d{2}$/.test(out)) out += ':00';
    onChange(out);
  };

  return (
    <div className="ss-moment">
      <Input
        mono
        value={text}
        placeholder={placeholder || MOMENTS[kind].text}
        error={error}
        spellCheck={false}
        aria-label={column.name}
        onChange={(e) => onChange(e.target.value)}
        suffix={<IconButton icon="clock" size="sm" label={t(`record.field.pick.${kind}`)} onClick={open} />}
      />
      <input
        ref={pick}
        type={PICKER[kind]}
        step={1}
        value={native}
        tabIndex={-1}
        aria-hidden
        className="ss-moment-native"
        onChange={(e) => chosen(e.target.value)}
      />
    </div>
  );
}

/** The most rows the list of a foreign key picker shows at once. */
const PICKER_ROWS = 50;

export interface FkPickerProps {
  column: Column & { fk: NonNullable<Column['fk']> };
  value: RecordValue | undefined;
  /** The rows of the table the key points at, and that table, for the column that names a row. */
  rows: readonly Row[];
  table?: Table;
  error?: boolean;
  /** The list starts open, with this typed in its search: for previews. */
  defaultOpen?: boolean;
  query?: string;
  onChange: (value: RecordValue) => void;
}

/** A foreign key is set by choosing a row of the table it points at, searched by its key or by what names it. */
export function FkPicker({ column, value, rows, table, error, defaultOpen, query, onChange }: FkPickerProps) {
  const { fk } = column;
  const key = fk.column;
  const label = table ? labelColumn(table) : null;
  const [open, setOpen, ref] = usePopover(defaultOpen);
  const [q, setQ] = useState(query ?? '');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const has = value !== undefined && value !== null && value !== '';
  const found = has ? rows.find((r) => String(r[key]) === String(value)) : null;
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? rows.filter((r) => String(r[key]).toLowerCase().includes(needle) || (label !== null && r[label] != null && String(r[label]).toLowerCase().includes(needle)))
    : rows;
  const shown = matches.slice(0, PICKER_ROWS);

  useEffect(() => {
    list.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (row: Row) => {
    onChange(row[key]);
    setOpen(false);
    setQ('');
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(shown.length - 1, active + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, active - 1));
    } else if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="ss-fkpick" ref={ref}>
      <button
        type="button"
        className={cx('ss-fkpick-btn', error && 'is-error', open && 'is-open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={column.name}
        onClick={() => {
          if (!open) {
            setQ('');
            setActive(0);
          }
          setOpen(!open);
        }}
      >
        {has ? (
          <>
            <span className="ss-fkpick-key">{`${fk.table}.${key} = ${value}`}</span>
            {found && label && found[label] != null && <span className="ss-fkpick-label">{` · ${found[label]}`}</span>}
          </>
        ) : (
          <span className="ss-fkpick-ph">{value === null ? 'NULL' : t('record.fk.choose', { table: fk.table })}</span>
        )}
        <Icon name="chevrons-ud" size={13} />
      </button>
      {open && (
        <div className="ss-pop ss-fkpick-pop">
          <div className="ss-fkpick-search">
            <Input
              icon="search"
              size="sm"
              placeholder={t('record.fk.search', { table: fk.table })}
              aria-label={t('record.fk.search', { table: fk.table })}
              value={q}
              autoFocus
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          </div>
          {shown.length ? (
            <div role="listbox" aria-label={fk.table} ref={list}>
              {shown.map((r, i) => (
                <div
                  key={i}
                  role="option"
                  aria-selected={has && String(r[key]) === String(value)}
                  className={cx('ss-pop-item', i === active && 'is-active')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(r);
                  }}
                >
                  <span>{String(r[key])}</span>
                  {label && r[label] != null && <small>{String(r[label])}</small>}
                </div>
              ))}
            </div>
          ) : (
            <div className="ss-fkpick-none">{t('record.fk.none', { table: fk.table, query: q.trim() })}</div>
          )}
          {matches.length > shown.length && (
            <div className="ss-fkpick-foot">{t('record.shownOf', { shown: formatNumber(shown.length), rows: rowsText(matches.length) })}</div>
          )}
        </div>
      )}
    </div>
  );
}
