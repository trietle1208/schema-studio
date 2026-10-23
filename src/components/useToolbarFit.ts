import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { nextFit, TOOLBAR_FIT_START, TOOLBAR_MAX_LEVEL, TOOLBAR_NAME_MIN, type ToolbarFit, type ToolbarLevel, type ToolbarMeasure } from '../core/toolbarFit';

/** What the start of the bar needs with the schema name at its least, and has. Layout is read, never changed. */
function measureStart(bar: HTMLElement, start: HTMLElement): ToolbarMeasure {
  // The start zone's own width is what the bar leaves it. Its natural width is read by letting it be
  // as wide as its content for a moment; nothing is painted in between.
  const { flex, width } = start.style;
  start.style.flex = 'none';
  start.style.width = 'max-content';
  const natural = start.getBoundingClientRect().width;
  start.style.flex = flex;
  start.style.width = width;
  const name = start.querySelector<HTMLElement>('.ss-tb-name');
  const nameWidth = name?.scrollWidth ?? 0;
  return {
    bar: bar.clientWidth,
    need: natural - nameWidth + Math.min(TOOLBAR_NAME_MIN, nameWidth),
    have: start.getBoundingClientRect().width,
  };
}

/**
 * How much of the toolbar has to give way (see `core/toolbarFit`). `key` names what the bar holds:
 * when it changes, the bar is shown whole and measured again.
 */
export function useToolbarFit(bar: RefObject<HTMLElement | null>, start: RefObject<HTMLElement | null>, key: string): ToolbarLevel {
  const [state, setState] = useState<{ key: string; fit: ToolbarFit }>({ key, fit: TOOLBAR_FIT_START });
  const fit = state.key === key ? state.fit : TOOLBAR_FIT_START;
  const latest = useRef(fit);
  useEffect(() => {
    latest.current = fit;
  });
  useEffect(() => {
    const barEl = bar.current;
    const startEl = start.current;
    if (!barEl || !startEl || typeof ResizeObserver === 'undefined') return;
    const settle = () => {
      // A level that changes nothing on screen (no zoom tools to put away) does not resize the start
      // zone, so the observer would not run again: step on until the measurement holds.
      for (let i = 0; i <= TOOLBAR_MAX_LEVEL + 1; i++) {
        const next = nextFit(latest.current, measureStart(barEl, startEl));
        if (next === latest.current) return;
        latest.current = next;
        flushSync(() => setState({ key, fit: next }));
      }
    };
    const observer = new ResizeObserver(settle);
    observer.observe(barEl);
    observer.observe(startEl);
    return () => observer.disconnect();
  }, [bar, start, key]);
  return fit.level;
}
