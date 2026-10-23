import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  layoutModuleLines,
  moduleCards,
  moduleColumns,
  moduleDimmed,
  moduleEdges,
  moduleStageSize,
  moduleStep,
  placeModules,
  prefixLine,
  savedModuleGroup,
  type ModuleDirection,
} from '../core/diagramView';
import { moduleColor } from '../core/explorer';
import { formatNumber, t } from '../core/i18n';
import type { GroupColor, Table, TableGroup } from '../core/model';
import { findHubs, type SchemaModule } from '../core/modules';
import { countInferred } from '../core/relations';
import { cx } from './cx';
import { Icon } from './Icon';
import { rich } from './rich';
import { Switch } from './Switch';

export interface ModulesViewProps {
  tables: readonly Table[];
  modules: readonly SchemaModule[];
  groups: readonly TableGroup[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  /** Opens the module on the Tables view: the tables it lists. */
  onOpen: (tables: readonly string[]) => void;
  /** Focuses one table of the module. */
  onFocus: (table: string) => void;
  /** Gives the module a label, as a group of its tables. */
  onRename: (tables: readonly string[], from: string, to: string, color: GroupColor) => void;
  hideHubs: boolean;
  onHideHubs: (on: boolean) => void;
  inferredOnly: boolean;
  onInferredOnly: (on: boolean) => void;
}

/** The label box of a count, wide enough for the digits and at least the pill of the reference. */
function labelBox(label: string): { width: number; height: number } {
  return { width: Math.max(26, label.length * 8 + 10), height: 18 };
}

export function ModulesView({
  tables,
  modules,
  groups,
  selected,
  onSelect,
  onOpen,
  onFocus,
  onRename,
  hideHubs,
  onHideHubs,
  inferredOnly,
  onInferredOnly,
}: ModulesViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<{ name: string; value: string } | null>(null);
  const skipBlur = useRef(false);
  const cards = useMemo(() => moduleCards(tables, modules), [tables, modules]);
  const chosen = cards.some((card) => card.name === selected) ? selected : null;
  const edges = useMemo(
    () => moduleEdges(tables, cards, { hideHubs, inferredOnly }),
    [tables, cards, hideHubs, inferredOnly],
  );
  const columns = moduleColumns(width);
  const placed = useMemo(() => placeModules(cards, columns, chosen), [cards, columns, chosen]);
  const stage = useMemo(() => moduleStageSize(placed), [placed]);
  const lines = useMemo(() => layoutModuleLines(placed, edges, chosen), [placed, edges, chosen]);
  const at = useMemo(() => new Map(placed.map((card) => [card.name, card])), [placed]);
  const hubs = useMemo(() => findHubs(tables), [tables]);
  const inferred = useMemo(() => countInferred(tables), [tables]);
  const hub = hideHubs ? hubs[0] : undefined;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDraft(null);
  }, [chosen]);

  const open = (name: string) => {
    const card = cards.find((item) => item.name === name);
    if (card) onOpen(card.tables);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' && chosen) {
      e.preventDefault();
      open(chosen);
      return;
    }
    const direction: ModuleDirection | null =
      e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : null;
    if (!direction) return;
    e.preventDefault();
    const next = chosen ? moduleStep(placed, chosen, direction) : placed[0]?.name;
    if (next) onSelect(next);
  };

  return (
    <div
      ref={root}
      className="ss-canvas ss-modules"
      tabIndex={0}
      role="application"
      aria-label={t('diagram.modules')}
      onKeyDown={onKey}
      onClick={() => onSelect(null)}
    >
      <div className="ss-modbar" onClick={(e) => e.stopPropagation()}>
        <span className="ss-modbar-pill is-accent">
          <Icon name="layers" size={15} />
          <b>{t('modules.count', { count: cards.length })}</b>
          <span>· {t('count.tables', { count: tables.length })}</span>
        </span>
        <span className="ss-modbar-pill">
          <Switch checked={hideHubs} onChange={onHideHubs} label={t('modules.hideHubLines')} />
          {hubs.length > 0 && (
            <span className="ss-modbar-k">
              {hubs.map((item) => `${item.table} · ${formatNumber(item.referencedBy)}`).join('   ')}
            </span>
          )}
        </span>
        <span className="ss-modbar-pill">
          <Switch checked={inferredOnly} onChange={onInferredOnly} label={t('modules.inferredOnly')} />
          <span className="ss-modbar-k">{formatNumber(inferred)}</span>
        </span>
        <span className="ss-spacer" />
        <span className="ss-modbar-pill">{t('modules.openHint')}</span>
      </div>
      <div className="ss-modules-scroll">
        <div className="ss-modules-stage" style={{ width: stage.width, height: stage.height }}>
          <svg className="ss-mod-edges" width={stage.width} height={stage.height} aria-hidden="true">
            {lines.map((line) => (
              <path
                key={`${line.from}\0${line.to}`}
                d={`M${line.x1} ${line.y1} L${line.x2} ${line.y2}`}
                className={line.active ? 'is-active' : undefined}
                strokeWidth={line.width}
              />
            ))}
          </svg>
          {cards.map((card, index) => {
            const place = at.get(card.name);
            if (!place) return null;
            const saved = savedModuleGroup(groups, card.tables);
            const color = saved?.color ?? moduleColor(card.name, index, groups);
            const title = saved?.name || card.name || t('explorer.other');
            const on = card.name === chosen;
            const editing = draft?.name === card.name;
            return (
              <div
                key={card.name || 'other'}
                className={cx('ss-modcard', `ss-group--${color}`, on && 'is-selected', moduleDimmed(card.name, chosen, edges) && 'is-dim')}
                style={{ left: place.x, top: place.y, width: place.width, height: place.height }}
                role="button"
                tabIndex={-1}
                aria-pressed={on}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(card.name);
                  root.current?.focus();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  open(card.name);
                }}
              >
                <div className="ss-modcard-bar" />
                <div className="ss-modcard-head">
                  {editing ? (
                    <input
                      className="ss-input ss-modcard-name"
                      aria-label={t('modules.renameLabel')}
                      value={draft.value}
                      autoFocus
                      data-local-edit=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraft({ name: card.name, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== 'Escape') return;
                        e.preventDefault();
                        e.stopPropagation();
                        skipBlur.current = true;
                        const next = draft.value.trim();
                        setDraft(null);
                        if (e.key === 'Enter' && next && next !== title) onRename(card.tables, title, next, color);
                      }}
                      onBlur={() => {
                        if (skipBlur.current) {
                          skipBlur.current = false;
                          return;
                        }
                        const next = draft.value.trim();
                        setDraft(null);
                        if (next && next !== title) onRename(card.tables, title, next, color);
                      }}
                    />
                  ) : (
                    <b className="ss-modcard-name" title={title}>
                      {title}
                    </b>
                  )}
                  <span className="ss-modcard-count">{formatNumber(card.tables.length)}</span>
                </div>
                {card.prefixes.length > 0 && <div className="ss-modcard-pre">{prefixLine(card.prefixes)}</div>}
                <ul className="ss-modcard-list">
                  {card.sample.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                  {card.more > 0 && <li className="is-more">{t('modules.more', { count: card.more })}</li>}
                </ul>
                {on && (
                  <div
                    className="ss-modcard-act"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <button type="button" onClick={() => open(card.name)}>
                      {t('modules.open')} ⏎
                    </button>
                    <span className="ss-modcard-sep">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const table = card.sample[0] ?? card.tables[0];
                        if (table) onFocus(table);
                      }}
                    >
                      {t('diagram.focus')}
                    </button>
                    <span className="ss-modcard-sep">·</span>
                    <button type="button" onClick={() => setDraft({ name: card.name, value: title })}>
                      {t('modules.rename')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <svg className="ss-mod-labels" width={stage.width} height={stage.height} aria-hidden="true">
            {lines.map((line) => {
              const label = formatNumber(line.relationships);
              const box = labelBox(label);
              return (
                <g key={`${line.from}\0${line.to}`} className={line.active ? 'is-active' : undefined}>
                  <rect
                    className="ss-mod-label"
                    x={line.labelX - box.width / 2}
                    y={line.labelY - box.height / 2}
                    width={box.width}
                    height={box.height}
                    rx={9}
                  />
                  <text className="ss-mod-count" x={line.labelX} y={line.labelY} dy="0.35em">
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {hub && (
        <div className="ss-mod-hub" onClick={(e) => e.stopPropagation()}>
          <Icon name="hub" size={15} />
          <span>
            {rich('modules.hubNote', {
              name: <b>{hub.table}</b>,
              count: hub.referencedBy,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
