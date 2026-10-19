import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { t } from '../core/i18n';
import { cx } from './cx';

/** How far an arrow key moves the handle. */
const KEY_STEP = 16;

export interface ResizeHandleProps {
  /** What the handle does, as assistive technology calls it: "Resize sidebar". */
  label: string;
  /**
   * The side of its panel the handle is at. A panel at the left of the screen has it at its right
   * and grows as the handle is dragged right; a panel at the right has it at its left. `top` is
   * for a panel at the bottom, which grows as the handle is dragged up (`bottom`: the other way).
   */
  edge: 'left' | 'right' | 'top' | 'bottom';
  width: number;
  min: number;
  max: number;
  /** The size that is wanted (the height for a horizontal handle), on every pointer move of a drag and on an arrow key. The caller keeps it within what it can be. */
  onResize: (width: number) => void;
  /** A double click: the panel is to be as wide as it is by itself. */
  onReset?: () => void;
}

/**
 * The line between a panel and what is next to it, which is dragged to make the panel wider or
 * narrower. It takes no room: place it between the two in a row. With the keyboard the arrows
 * move it, and Home and End make the panel as narrow and as wide as it can be.
 */
export function ResizeHandle({ label, edge, width, min, max, onResize, onReset }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  /** Where the pointer was and how wide the panel when the drag began. */
  const drag = useRef<{ x: number; width: number } | null>(null);
  /** A handle on the top or bottom edge divides rows and is dragged up and down. */
  const across = edge === 'top' || edge === 'bottom';
  /** What a move to the right (down for a horizontal handle) makes of the size. */
  const grows = edge === 'right' || edge === 'bottom' ? 1 : -1;
  /** Where the pointer is, along the way the handle is dragged. */
  const at = (e: PointerEvent<HTMLDivElement>) => (across ? e.clientY : e.clientX);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // No text is selected by the drag.
    e.preventDefault();
    drag.current = { x: at(e), width };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d) onResize(d.width + grows * (at(e) - d.x));
  }

  function end() {
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    // ↑ ↓ move a horizontal handle as ← → move a vertical one.
    const key = across ? ({ ArrowUp: 'ArrowLeft', ArrowDown: 'ArrowRight' } as Record<string, string>)[e.key] ?? e.key : e.key;
    if (key === 'ArrowLeft') next = width - grows * KEY_STEP;
    else if (key === 'ArrowRight') next = width + grows * KEY_STEP;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    onResize(next);
  }

  return (
    <div
      className={cx('ss-resize', `ss-resize--${edge}`, dragging && 'is-dragging')}
      role="separator"
      aria-orientation={across ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={onReset ? t('resize.hintReset') : t('resize.hint')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onLostPointerCapture={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
