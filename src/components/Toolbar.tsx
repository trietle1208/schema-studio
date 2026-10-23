import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { splitShortcut, type ToolbarLevel } from '../core/toolbarFit';
import type { DiagramView } from '../core/diagramView';
import { t } from '../core/i18n';
import { LARGE_TABLE, stepZoom, ZOOM_STEP } from '../core/layout';
import type { WorkspaceMode } from '../core/routes';
import { Badge } from './Badge';
import type { ColumnsChoice } from '../core/edit';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Kbd } from './Kbd';
import { ModeSwitch } from './ModeSwitch';
import { SegmentedControl } from './SegmentedControl';
import { usePopover } from './usePopover';
import { useToolbarFit } from './useToolbarFit';

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
      className={cx('ss-tb-link', className)}
      role="link"
      tabIndex={0}
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
    <div ref={box} className="ss-tb-menu">
      <IconButton icon="columns" label={selected ? t('columns.menuSelected') : t('columns.menu')} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="ss-tb-pop">
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

/** `Zoom out (⌘−)` as a menu item: the words, with the keys on the right. */
function item(icon: MenuItem['icon'], text: string, onSelect?: () => void, note?: string): MenuItem {
  const { label, shortcut } = splitShortcut(text);
  return { icon, label: note ? `${label} · ${note}` : label, ...(shortcut ? { shortcut } : {}), onSelect };
}

/** The ⋯ button of a bar that is too narrow for all its tools: what was put away is in its menu. */
function MoreMenu({ items }: { items: (MenuItem | '-')[] }) {
  const [open, setOpen, box] = usePopover();
  return (
    <div ref={box} className="ss-tb-menu">
      <IconButton icon="more" label={t('toolbar.more')} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="ss-tb-pop">
          <ContextMenu label={t('toolbar.more')} onClose={() => setOpen(false)} items={items} />
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
  /** The mode on show. Giving it, or `onMode`, adds the Diagram / Data / Query switch; the zoom tools are only for the diagram. */
  mode?: WorkspaceMode;
  onMode?: (mode: WorkspaceMode) => void;
  /** The schema has no tables, so Data has nothing to show. */
  dataDisabled?: boolean;
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
  /** Modules, Tables or Focus, shown beside the canvas tools while the diagram is open. */
  diagramView?: DiagramView;
  onDiagramView?: (view: DiagramView) => void;
  // History, Share and Export stay disabled without a handler.
  onHistory?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  /**
   * `centered` is the workspace chrome: three zones with the mode switch in the middle.
   * Screens without a mode switch keep the compact bar.
   */
  chrome?: 'bar' | 'centered';
}

export function Toolbar({
  schema,
  engine,
  version,
  mode = 'diagram',
  onMode,
  dataDisabled,
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
  diagramView,
  onDiagramView,
  onHistory,
  onShare,
  onExport,
  chrome = 'bar',
}: ToolbarProps) {
  const showModes = !!onMode;
  const centered = chrome === 'centered';
  const bar = useRef<HTMLElement>(null);
  const start = useRef<HTMLDivElement>(null);
  // What the bar holds decides how much room it needs: the fit is measured again when it changes.
  const level: ToolbarLevel = useToolbarFit(
    bar,
    start,
    [mode, diagramView, saveState, schema, engine, version, t('common.schemas'), !!onArrange, !!onShowColumns].join('|'),
  );

  const identity = (
    <div className="ss-tb-identity">
      <div className="ss-tb-crumb">
        <Crumb onClick={onSchemas}>{t('common.schemas')}</Crumb>
        <Icon name="chevron-right" size={12} />
        <span className="ss-tb-name" title={schema}>
          {schema}
        </span>
      </div>
      {(engine || version) && (
        <span className="ss-tb-badges">
          {engine && level < 4 && (
            <Badge tone="outline" title={t('toolbar.engine')}>
              {engine}
            </Badge>
          )}
          {version && (
            <Badge tone="accent" title={t('toolbar.version')}>
              {version}
            </Badge>
          )}
        </span>
      )}
    </div>
  );

  const save = (
    <div className={cx('ss-tb-save', saveState === 'dirty' && 'is-dirty')}>
      <SaveStatus state={saveState} />
      {saveState === 'dirty' && (
        <Button size="sm" kbd={level >= 3 ? undefined : ['⌘', 'S']} onClick={onSave}>
          {t('toolbar.save')}
        </Button>
      )}
    </div>
  );

  const diagramSwitch = mode === 'diagram' && onDiagramView && (
    <div className="ss-diagram-switch" role="group" aria-label={t('diagram.view')}>
      <SegmentedControl
        className="ss-diagram-view"
        value={diagramView ?? 'tables'}
        onChange={(value) => onDiagramView(value as DiagramView)}
        options={[
          { value: 'modules', label: t('diagram.modules'), icon: 'grid' },
          { value: 'tables', label: t('diagram.tables'), icon: 'table' },
          { value: 'focus', label: t('diagram.focus'), icon: 'focus' },
        ]}
      />
    </div>
  );

  const hasCanvasTools = mode === 'diagram' && diagramView !== 'modules' && diagramView !== 'focus';
  // A narrow bar puts the zoom tools, and then undo, redo, history and share, in the ⋯ menu.
  const toolsAway = level >= 1 && hasCanvasTools;
  const historyAway = level >= 3;
  const moreItems: (MenuItem | '-')[] = [];
  if (toolsAway) {
    moreItems.push(
      item('zoom-out', t('toolbar.zoomOut'), () => onZoom?.(stepZoom(zoom, -ZOOM_STEP))),
      item('zoom-in', t('toolbar.zoomIn'), () => onZoom?.(stepZoom(zoom, ZOOM_STEP))),
      item('refresh', t('toolbar.zoomReset'), () => onZoom?.(1), `${Math.round(zoom * 100)}%`),
      item('fit', t('toolbar.fit'), onFit),
    );
    if (onArrange) moreItems.push(item('sparkle', `${arrangeSelected ? t('action.arrangeSelected') : t('action.arrange')} (⇧A)`, onArrange));
    if (onShowColumns) {
      moreItems.push(
        '-',
        item('columns', t('columns.all'), () => onShowColumns('all')),
        item('key', t('columns.keys'), () => onShowColumns('keys')),
        item('minus', t('columns.none'), () => onShowColumns('none')),
      );
      if (!columnsSelected) moreItems.push(item('filter', t('columns.large'), () => onShowColumns('large')));
    }
  }
  if (historyAway) {
    if (moreItems.length) moreItems.push('-');
    moreItems.push(
      item('undo', t('toolbar.undo'), canUndo === false ? undefined : onUndo),
      item('redo', t('toolbar.redo'), canRedo === false ? undefined : onRedo),
      ...(onHistory ? [item('history', t('toolbar.history'), onHistory)] : []),
      ...(onShare ? [item('share', t('toolbar.share'), onShare)] : []),
    );
  }
  const more = moreItems.length > 0 && <MoreMenu items={moreItems} />;

  const canvasTools = hasCanvasTools && !toolsAway && (
    <div className="ss-tb-tools" role="group" aria-label={t('toolbar.canvasGroup')}>
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
  );

  const searchBox = (
    <div className={cx('ss-tb-search', centered && 'ss-tb-search--wide', level >= 2 && 'is-narrow')}>
      <Input
        icon="search"
        placeholder={t('toolbar.search')}
        size="sm"
        suffix={level >= 2 ? undefined : <Kbd keys={['⌘', 'K']} />}
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
  );

  const history = !historyAway && (
    <ButtonGroup label={t('toolbar.historyGroup')}>
      <IconButton icon="undo" label={t('toolbar.undo')} disabled={canUndo === false} onClick={onUndo} />
      <IconButton icon="redo" label={t('toolbar.redo')} disabled={canRedo === false} onClick={onRedo} />
      <IconButton icon="history" label={t('toolbar.history')} disabled={!onHistory} onClick={onHistory} />
    </ButtonGroup>
  );

  const share = !historyAway && <IconButton icon="share" label={t('toolbar.share')} disabled={!onShare} onClick={onShare} />;

  // Export is the one primary action: it keeps its place and becomes an icon when the bar is narrow.
  const exportButton =
    level >= 2 ? (
      <IconButton variant="primary" icon="download" label={t('common.exportSchema')} disabled={!onExport} onClick={onExport} />
    ) : (
      <Button variant="primary" icon="download" disabled={!onExport} onClick={onExport}>
        {t('common.exportSchema')}
      </Button>
    );

  if (centered) {
    return (
      <header ref={bar} className="ss-toolbar ss-toolbar--centered" data-fit={level}>
        <div ref={start} className="ss-tb-zone ss-tb-zone--start">
          {identity}
          <span className="ss-tb-sep" />
          {save}
        </div>
        <div className="ss-tb-zone ss-tb-zone--center">{showModes && <ModeSwitch value={mode} onChange={onMode} dataDisabled={dataDisabled} large />}</div>
        <div className="ss-tb-zone ss-tb-zone--end">
          {diagramSwitch}
          {canvasTools}
          {searchBox}
          {history}
          {share}
          {more}
          {exportButton}
        </div>
      </header>
    );
  }

  return (
    <header ref={bar} className="ss-toolbar">
      {identity}
      <span className="ss-tb-sep" />
      {save}
      {showModes && <ModeSwitch value={mode} onChange={onMode} dataDisabled={dataDisabled} />}
      <span className="ss-spacer" />
      {diagramSwitch}
      {canvasTools}
      {searchBox}
      {history}
      {share}
        <Button variant="primary" icon="download" disabled={!onExport} onClick={onExport}>
        {t('common.export')}
      </Button>
    </header>
  );
}
