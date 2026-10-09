import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { t } from '../core/i18n';
import { LARGE_TABLE, stepZoom, ZOOM_STEP } from '../core/layout';
import { Badge } from './Badge';
import type { ColumnsChoice } from '../core/edit';
import { Button } from './Button';
import { ContextMenu } from './ContextMenu';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Kbd } from './Kbd';

export type SaveState = 'saved' | 'dirty' | 'saving';

export interface SaveStatusProps {
  state?: SaveState;
  label?: string;
}

export function SaveStatus({ state = 'saved', label }: SaveStatusProps) {
  if (state === 'dirty') {
    return (
      <span className="ss-save is-dirty" role="status">
        <span className="ss-save-dot" />
        {label || t('save.dirty')}
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="ss-save" role="status">
        {t('save.saving')}
      </span>
    );
  }
  return (
    <span className="ss-save is-saved" role="status">
      <Icon name="check" size={14} />
      {label || t('save.saved')}
    </span>
  );
}

export interface CrumbProps {
  /** Makes the crumb a link. */
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

/** A step of the toolbar breadcrumb. With a handler it works as a link, for the mouse and the keyboard. */
export function Crumb({ onClick, className, children }: CrumbProps) {
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <span
      className={className}
      role="link"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick();
      }}
    >
      {children}
    </span>
  );
}

/** The button of the toolbar that opens the menu of what the tables show of their columns. */
function ColumnsMenu({ onChoose, selected }: { onChoose: (choice: ColumnsChoice) => void; selected?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // A press anywhere else, or Esc, closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <IconButton icon="columns" label={selected ? t('columns.menuSelected') : t('columns.menu')} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 30 }}>
          <ContextMenu
            label={selected ? t('columns.menuSelected') : t('columns.menu')}
            onClose={() => setOpen(false)}
            items={[
              { icon: 'columns', label: t('columns.all'), onSelect: () => onChoose('all') },
              { icon: 'key', label: t('columns.keys'), onSelect: () => onChoose('keys') },
              { icon: 'minus', label: t('columns.none'), onSelect: () => onChoose('none') },
              ...(selected ? [] : (['-', { icon: 'filter', label: `${t('columns.large')} · ${t('columns.largeHint', { count: LARGE_TABLE })}`, onSelect: () => onChoose('large') }] as const)),
            ]}
          />
        </div>
      )}
    </div>
  );
}

export interface ToolbarProps {
  schema?: string;
  engine?: string;
  /** The current version, e.g. `v12`. The badge is left out until the schema has one. */
  version?: string;
  saveState?: SaveState;
  onSave?: () => void;
  zoom?: number;
  onZoom?: (zoom: number) => void;
  onFit?: () => void;
  /** Adds "Arrange tables" next to the zoom buttons. */
  onArrange?: () => void;
  /** Several tables are selected: the button arranges only them, and says so. */
  arrangeSelected?: boolean;
  /** Adds the "Columns" menu next to them: what the tables show of their columns. */
  onShowColumns?: (choice: ColumnsChoice) => void;
  /** Several tables are selected: the menu applies to them, and says so. */
  columnsSelected?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  search?: string;
  onSearch?: (query: string) => void;
  /** Enter in the search box. */
  onSearchSubmit?: () => void;
  searchRef?: Ref<HTMLInputElement>;
  /** Makes "Schemas" in the breadcrumb a link to the schema list. */
  onSchemas?: () => void;
  // History, Share and Export stay disabled without a handler.
  onHistory?: () => void;
  onShare?: () => void;
  onExport?: () => void;
}

export function Toolbar({
  schema,
  engine,
  version,
  saveState,
  onSave,
  zoom = 1,
  onZoom,
  onFit,
  onArrange,
  arrangeSelected,
  onShowColumns,
  columnsSelected,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  search,
  onSearch,
  onSearchSubmit,
  searchRef,
  onSchemas,
  onHistory,
  onShare,
  onExport,
}: ToolbarProps) {
  return (
    <header className="ss-toolbar">
      <div className="ss-tb-crumb">
        <Crumb onClick={onSchemas}>{t('common.schemas')}</Crumb>
        <Icon name="chevron-right" size={12} />
        <span className="ss-tb-name">
          {schema}
          <Icon name="chevron-down" size={12} style={{ color: 'var(--ink-3)' }} />
        </span>
      </div>
      {engine && (
        <Badge dot title={t('toolbar.engine')}>
          {engine}
        </Badge>
      )}
      {version && (
        <Badge tone="accent" title={t('toolbar.version')}>
          {version}
        </Badge>
      )}
      <SaveStatus state={saveState} />
      {saveState === 'dirty' && (
        <Button size="sm" kbd={['⌘', 'S']} onClick={onSave}>
          {t('toolbar.save')}
        </Button>
      )}
      <span className="ss-spacer" />
      <div className="ss-tb-group">
        <IconButton icon="undo" label={t('toolbar.undo')} disabled={canUndo === false} onClick={onUndo} />
        <IconButton icon="redo" label={t('toolbar.redo')} disabled={canRedo === false} onClick={onRedo} />
      </div>
      <span className="ss-tb-sep" />
      <div className="ss-tb-group">
        <IconButton icon="zoom-out" label={t('toolbar.zoomOut')} onClick={() => onZoom?.(stepZoom(zoom, -ZOOM_STEP))} />
        <button type="button" className="ss-tb-zoom" title={t('toolbar.zoomReset')} onClick={() => onZoom?.(1)}>
          {`${Math.round(zoom * 100)}%`}
        </button>
        <IconButton icon="zoom-in" label={t('toolbar.zoomIn')} onClick={() => onZoom?.(stepZoom(zoom, ZOOM_STEP))} />
        <IconButton icon="fit" label={t('toolbar.fit')} onClick={onFit} />
        {onArrange && (
          <IconButton icon="sparkle" label={`${arrangeSelected ? t('action.arrangeSelected') : t('action.arrange')} (⇧A)`} onClick={onArrange} />
        )}
        {onShowColumns && <ColumnsMenu onChoose={onShowColumns} selected={columnsSelected} />}
      </div>
      <span className="ss-tb-sep" />
      <div className="ss-tb-search">
        <Input
          icon="search"
          placeholder={t('toolbar.search')}
          size="sm"
          suffix={<Kbd keys={['⌘', 'K']} />}
          value={search ?? ''}
          onChange={onSearch ? (e) => onSearch(e.target.value) : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchSubmit?.();
            // Esc clears the search first, then leaves the field.
            if (e.key !== 'Escape') return;
            if (search) onSearch?.('');
            else e.currentTarget.blur();
          }}
          readOnly={!onSearch}
          inputRef={searchRef}
          spellCheck={false}
          aria-label={t('toolbar.searchLabel')}
          data-local-edit
        />
      </div>
      <IconButton icon="history" label={t('toolbar.history')} disabled={!onHistory} onClick={onHistory} />
      <Button icon="share" disabled={!onShare} onClick={onShare}>
        {t('toolbar.share')}
      </Button>
      <Button variant="primary" icon="download" disabled={!onExport} onClick={onExport}>
        {t('common.export')}
      </Button>
    </header>
  );
}
