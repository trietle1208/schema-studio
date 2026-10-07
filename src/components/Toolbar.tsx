import type { Ref } from 'react';
import { stepZoom } from '../core/layout';
import { Badge } from './Badge';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Kbd } from './Kbd';

const ZOOM_STEP = 0.1;

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
        {label || 'Unsaved changes'}
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="ss-save" role="status">
        Saving…
      </span>
    );
  }
  return (
    <span className="ss-save is-saved" role="status">
      <Icon name="check" size={14} />
      {label || 'Saved'}
    </span>
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
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  search?: string;
  onSearch?: (query: string) => void;
  /** Enter in the search box. */
  onSearchSubmit?: () => void;
  searchRef?: Ref<HTMLInputElement>;
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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  search,
  onSearch,
  onSearchSubmit,
  searchRef,
  onHistory,
  onShare,
  onExport,
}: ToolbarProps) {
  return (
    <header className="ss-toolbar">
      <div className="ss-tb-crumb">
        <span>Schemas</span>
        <Icon name="chevron-right" size={12} />
        <span className="ss-tb-name">
          {schema}
          <Icon name="chevron-down" size={12} style={{ color: 'var(--ink-3)' }} />
        </span>
      </div>
      {engine && (
        <Badge dot title="Database engine">
          {engine}
        </Badge>
      )}
      {version && (
        <Badge tone="accent" title="Current version">
          {version}
        </Badge>
      )}
      <SaveStatus state={saveState} />
      {saveState === 'dirty' && (
        <Button size="sm" kbd={['⌘', 'S']} onClick={onSave}>
          Save
        </Button>
      )}
      <span className="ss-spacer" />
      <div className="ss-tb-group">
        <IconButton icon="undo" label="Undo (⌘Z)" disabled={canUndo === false} onClick={onUndo} />
        <IconButton icon="redo" label="Redo (⇧⌘Z)" disabled={canRedo === false} onClick={onRedo} />
      </div>
      <span className="ss-tb-sep" />
      <div className="ss-tb-group">
        <IconButton icon="zoom-out" label="Zoom out (⌘−)" onClick={() => onZoom?.(stepZoom(zoom, -ZOOM_STEP))} />
        <button type="button" className="ss-tb-zoom" title="Reset zoom (⌘0)" onClick={() => onZoom?.(1)}>
          {`${Math.round(zoom * 100)}%`}
        </button>
        <IconButton icon="zoom-in" label="Zoom in (⌘+)" onClick={() => onZoom?.(stepZoom(zoom, ZOOM_STEP))} />
        <IconButton icon="fit" label="Fit to screen (⇧1)" onClick={onFit} />
      </div>
      <span className="ss-tb-sep" />
      <div className="ss-tb-search">
        <Input
          icon="search"
          placeholder="Search tables…"
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
          aria-label="Search tables"
          data-local-edit
        />
      </div>
      <IconButton icon="history" label="Version history (⌘H)" disabled={!onHistory} onClick={onHistory} />
      <Button icon="share" disabled={!onShare} onClick={onShare}>
        Share
      </Button>
      <Button variant="primary" icon="download" disabled={!onExport} onClick={onExport}>
        Export
      </Button>
    </header>
  );
}
