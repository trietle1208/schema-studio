import { useEffect, useMemo, useRef } from 'react';
import { useUiStore } from '../store/ui';
import {
  fitFocus,
  focusLines,
  placeFocus,
  FOCUS_GAP_X,
  FOCUS_LABEL_Y,
  FOCUS_ORIGIN_X,
  type FocusDepth,
  type FocusGraph,
  type PlacedFocusNode,
} from '../core/focusView';
import { moduleColor } from '../core/explorer';
import { savedModuleGroup } from '../core/diagramView';
import { formatNumber, t } from '../core/i18n';
import type { GroupColor, TableGroup } from '../core/model';
import type { SchemaModule } from '../core/modules';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { Switch } from './Switch';
import { useElementWidth } from './useElementWidth';

export interface FocusViewProps {
  groups: readonly TableGroup[];
  modules: readonly SchemaModule[];
  /** The cards of the view. Null until a table is focused. */
  graph: FocusGraph | null;
  /** The table in the middle, named on the bar. */
  center: string | null;
  trail: readonly string[];
  depth: FocusDepth;
  hubsAsTags: boolean;
  keysOnly: boolean;
  onDepth: (depth: FocusDepth) => void;
  onHubsAsTags: (on: boolean) => void;
  onKeysOnly: (on: boolean) => void;
  onToggleExpanded: (table: string) => void;
  onFocus: (table: string) => void;
  onBack: () => void;
  onTrail: (index: number) => void;
  onAddToCanvas: (tables: readonly string[]) => void;
  onSaveView: (tables: readonly string[]) => void;
  /** Focuses the path field of the inspector. */
  onPath: () => void;
}

export function FocusView({
  groups,
  modules,
  graph,
  center,
  trail,
  depth,
  hubsAsTags,
  keysOnly,
  onDepth,
  onHubsAsTags,
  onKeysOnly,
  onToggleExpanded,
  onFocus,
  onBack,
  onTrail,
  onAddToCanvas,
  onSaveView,
  onPath,
}: FocusViewProps) {
  const scroll = useRef<HTMLDivElement>(null);
  // The columns are laid out for the room the canvas has: the gap between them gives first, then the zoom.
  const room = useElementWidth(scroll);
  const fit = useMemo(() => (graph ? fitFocus(graph.nodes, room) : { gap: FOCUS_GAP_X, zoom: 1 }), [graph, room]);
  const placed = graph ? placeFocus(graph.nodes, fit.gap) : null;
  const lines = graph && placed ? focusLines(placed.nodes, graph.edges) : [];
  const names = graph?.nodes.map((node) => node.table) ?? [];
  const moduleIndex = new Map(modules.map((module, index) => [module.name, index]));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== '1' && e.key !== '2' && e.key !== '3') return;
      if (useUiStore.getState().dialog) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      onDepth(Number(e.key) as FocusDepth);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDepth]);

  return (
    <div className="ss-canvas ss-focus" tabIndex={0} role="application" aria-label={t('diagram.focus')}>
      <div className="ss-modbar">
        <span className="ss-modbar-pill is-accent">
          <Icon name="focus" size={15} />
          {t('diagram.focus')}
          {center && <b className="ss-mono">{center}</b>}
        </span>
        <span className="ss-modbar-pill">
          <span className="ss-caption ss-focus-depth-label">{t('focus.depth')}</span>
          <span className="ss-focus-depth" role="group" aria-label={t('focus.depth')}>
            {([1, 2, 3] as const).map((step) => (
              <button key={step} type="button" className={cx(depth === step && 'is-on')} aria-pressed={depth === step} onClick={() => onDepth(step)}>
                {step}
              </button>
            ))}
          </span>
        </span>
        <span className="ss-modbar-pill">
          <Switch checked={hubsAsTags} onChange={onHubsAsTags} label={t('focus.hubsAsTags')} />
        </span>
        <span className="ss-modbar-pill">
          <Switch checked={keysOnly} onChange={onKeysOnly} label={t('focus.keysOnly')} />
        </span>
        <span className="ss-spacer" />
        <span className="ss-modbar-pill">
          <button type="button" className="ss-focus-pathbtn" onClick={onPath} disabled={!center}>
            <Icon name="route" size={15} />
            {t('focus.path')}
          </button>
        </span>
      </div>

      <div ref={scroll} className="ss-focus-scroll">
        {placed && graph ? (
          <div className="ss-focus-zoom" style={{ width: placed.width * fit.zoom, height: placed.height * fit.zoom }}>
            <div
              className="ss-focus-stage"
              data-zoom={fit.zoom}
              style={{ width: placed.width, height: placed.height, ...(fit.zoom < 1 ? { transform: `scale(${fit.zoom})` } : {}) }}
            >
              <LaneLabel nodes={placed.nodes} side="left" />
              <LaneLabel nodes={placed.nodes} side="center" />
              <LaneLabel nodes={placed.nodes} side="right" gap={fit.gap} />
              <svg className="ss-focus-edges" width={placed.width} height={placed.height} aria-hidden="true">
                {lines.map((line) => (
                  <path key={line.key} d={line.d} />
                ))}
              </svg>
              {placed.nodes.map((node) => {
                const source = modules.find((module) => module.name === node.module);
                const saved = source ? savedModuleGroup(groups, source.tables) : undefined;
                const color: GroupColor | null = node.module ? (saved?.color ?? moduleColor(node.module, moduleIndex.get(node.module) ?? 0, groups)) : null;
                return (
                  <div
                    key={node.table}
                    className={cx('ss-fnode', node.lane === 0 && 'is-center', color && `ss-group--${color}`)}
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                    role="button"
                    tabIndex={-1}
                    onClick={() => onFocus(node.table)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onFocus(node.table);
                      }
                    }}
                  >
                    <div className="ss-fnode-head">
                      {color && <span className="ss-fnode-bar" />}
                      <Icon name="table" size={13} />
                      <b title={node.table}>{node.table}</b>
                      <span className="ss-fnode-n">{formatNumber(node.total)}</span>
                    </div>
                    {node.columns.map((column) => (
                      <div key={column.name} className={cx('ss-fnode-row', column.kind === 'pk' && 'is-pk', column.kind === 'fk' && 'is-fk', column.join && 'is-join')}>
                        {column.kind === 'pk' ? <Icon name="key" size={11} /> : column.kind === 'fk' ? <Icon name="link" size={11} /> : <span className="ss-fnode-gap" />}
                        <span className="ss-fnode-col" title={column.name}>{column.name}</span>
                        {column.hub ? (
                          <span className="ss-fnode-hub" title={column.hub}>
                            <Icon name="hub" size={9} />
                            {column.hub}
                          </span>
                        ) : (
                          <span className="ss-fnode-type" title={column.type}>{column.type}</span>
                        )}
                      </div>
                    ))}
                    {node.more > 0 && <div className="ss-fnode-more">{t('focus.moreColumns', { count: node.more })}</div>}
                    {node.hidden > 0 && (
                      <button
                        type="button"
                        className={cx('ss-fnode-badge', node.lane > 0 && 'is-ghost')}
                        aria-label={t('focus.expand', { count: node.hidden })}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpanded(node.table);
                        }}
                      >
                        {t('focus.badge', { count: node.hidden })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="ss-focus-empty">{t('modules.focusPick')}</p>
        )}
      </div>

      {graph && (
        <div className="ss-focus-tray">
          <div className="ss-focus-crumbs">
            <button type="button" className="ss-focus-back" aria-label={t('focus.back')} disabled={trail.length < 2} onClick={onBack}>
              <Icon name="arrow-left" size={14} />
            </button>
            {trail.map((name, index) => {
              const last = index === trail.length - 1;
              return (
                <span key={`${name}-${index}`} className="ss-focus-crumb">
                  {index > 0 && <span className="ss-focus-sep">›</span>}
                  {last ? (
                    <span className="is-cur" title={name}>{name}</span>
                  ) : (
                    <button type="button" title={name} onClick={() => onTrail(index)}>{name}</button>
                  )}
                </span>
              );
            })}
          </div>
          <span className="ss-spacer" />
          <div className="ss-focus-ws">
            <span>
              <b>{t('count.tables', { count: names.length })}</b> {t('focus.inView')}
            </span>
            <Button size="sm" onClick={() => onAddToCanvas(names)}>{t('focus.addToCanvas')}</Button>
            <Button variant="primary" size="sm" icon="bookmark" onClick={() => onSaveView(names)}>{t('focus.saveView')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LaneLabel({ nodes, side, gap = FOCUS_GAP_X }: { nodes: readonly PlacedFocusNode[]; side: 'left' | 'center' | 'right'; gap?: number }) {
  const list = nodes.filter((node) => (side === 'left' ? node.lane < 0 : side === 'right' ? node.lane > 0 : node.lane === 0));
  const center = nodes.find((node) => node.lane === 0);
  const left = side === 'left' ? FOCUS_ORIGIN_X : side === 'center' ? (center?.x ?? FOCUS_ORIGIN_X) : undefined;
  const x = list.length ? Math.min(...list.map((node) => node.x)) : left;
  if (x === undefined && side === 'right') {
    const after = center ? center.x + center.width + gap : FOCUS_ORIGIN_X;
    return (
      <span className="ss-focus-lane" style={{ left: after, top: FOCUS_LABEL_Y }}>
        {t('focus.references')} · {formatNumber(0)}
      </span>
    );
  }
  const text = side === 'left' ? t('focus.referencedBy') : side === 'right' ? t('focus.references') : t('focus.selected');
  return (
    <span className="ss-focus-lane" style={{ left: x ?? FOCUS_ORIGIN_X, top: FOCUS_LABEL_Y }}>
      {text}
      {side !== 'center' && ` · ${formatNumber(list.length)}`}
    </span>
  );
}
