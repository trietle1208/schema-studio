import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { familyLabel, matchTypes, normalizeType, typeEngine, typesFor } from '../core/datatypes';
import { t } from '../core/i18n';
import { cx } from './cx';
import { Icon } from './Icon';
import { Input } from './Input';

// Room the list needs on its preferred side before it opens on the other one.
const MIN_LIST_ROOM = 120;
// These mirror .ss-pop--top: its max-height and its distance from the input.
const TOP_LIST_HEIGHT = 236;
const LIST_GAP = 4;

export interface TypeSelectProps {
  value: string;
  onChange?: (type: string) => void;
  /** The database engine whose types the list offers. */
  engine?: string;
  size?: 'md' | 'sm';
  error?: boolean;
  defaultOpen?: boolean;
  /** The side the list prefers. It opens on the other side when a scrolling ancestor would clip it. */
  placement?: 'bottom' | 'top';
  align?: 'start' | 'end';
  inputClassName?: string;
}

interface ListPlacement {
  top: boolean;
  maxHeight?: number;
}

/** The space above and below `el` inside the nearest ancestor that clips its overflow, or the viewport. */
function roomAround(el: HTMLElement): { above: number; below: number } {
  const r = el.getBoundingClientRect();
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflowY === 'visible') continue;
    const c = p.getBoundingClientRect();
    return { above: r.top - c.top, below: c.bottom - r.bottom };
  }
  return { above: r.top, below: window.innerHeight - r.bottom };
}

export function TypeSelect({ value, onChange, engine = 'PostgreSQL', size, error, defaultOpen, placement, align, inputClassName }: TypeSelectProps) {
  const preferTop = placement === 'top';
  const [list, setList] = useState<ListPlacement | null>(defaultOpen ? { top: preferTop } : null);
  const [query, setQuery] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const needle = normalizeType(query ?? '');
  const matches = matchTypes(needle, typesFor(engine));

  function open() {
    if (list) return;
    const el = ref.current;
    if (!el) return setList({ top: preferTop });
    const { above, below } = roomAround(el);
    // A list that opens upwards past the top of a scroll container cannot be scrolled into view,
    // so it is kept inside; one that opens downwards just makes the container scroll further.
    const top = preferTop ? above >= MIN_LIST_ROOM || above > below : below < MIN_LIST_ROOM && above > below;
    const fits = above - LIST_GAP * 2;
    setList(top && fits < TOP_LIST_HEIGHT ? { top, maxHeight: Math.max(0, fits) } : { top });
  }

  function close() {
    setList(null);
  }

  function commit(type: string) {
    if (type !== value) onChange?.(type);
    setQuery(null);
    close();
  }

  return (
    <div ref={ref} className="ss-typesel">
      <Input
        mono
        value={query ?? value}
        placeholder={t('type.placeholder')}
        spellCheck={false}
        data-local-edit
        error={error}
        size={size}
        className={inputClassName}
        onFocus={open}
        onClick={open}
        onBlur={() => (query != null ? commit(normalizeType(query)) : close())}
        onChange={(e) => {
          setQuery(e.target.value);
          open();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key !== 'Enter') return;
          // ⌘/Ctrl + Enter belongs to the surrounding form (add column), which may unmount this
          // input before it blurs: keep what was typed and let the event through.
          if (e.metaKey || e.ctrlKey) {
            if (query != null) commit(needle);
            return;
          }
          e.preventDefault();
          if (needle && matches[0]) commit(matches[0].name);
          else if (query != null) commit(needle);
          else close();
        }}
        aria-label={t('type.label')}
        suffix={<Icon name="chevrons-ud" size={13} style={{ color: 'var(--ink-3)' }} />}
      />
      {list && matches.length > 0 && (
        <div
          className={cx('ss-pop', list.top && 'ss-pop--top', align === 'end' && 'ss-pop--end')}
          style={list.maxHeight === undefined ? undefined : { maxHeight: list.maxHeight }}
          role="listbox"
        >
          <div className="ss-pop-group ss-caption">{needle ? t('type.matches') : t('type.engineTypes', { engine: typeEngine(engine) })}</div>
          {matches.map((type, i) => {
            const at = needle ? type.name.indexOf(needle) : -1;
            const label: ReactNode =
              at >= 0 ? (
                <>
                  {type.name.slice(0, at)}
                  <mark>{type.name.slice(at, at + needle.length)}</mark>
                  {type.name.slice(at + needle.length)}
                </>
              ) : (
                type.name
              );
            return (
              <div
                key={type.name}
                role="option"
                aria-selected={type.name === value}
                className={cx('ss-pop-item', (type.name === value || (!!needle && i === 0)) && 'is-active')}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(type.name);
                }}
              >
                <span>{label}</span>
                <small>{familyLabel(type.family)}</small>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
