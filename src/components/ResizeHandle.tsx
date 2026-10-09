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
   * and grows as the handle is dragged right; a panel at the right has it at its left.
   */
  edge: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  /** The width that is wanted, on every pointer move of a drag and on an arrow key. The caller keeps it within what it can be. */
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
  /** What a move to the right makes of the width. */
  const grows = edge === 'right' ? 1 : -1;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // No text is selected by the drag.
    e.preventDefault();
    drag.current = { x: e.clientX, width };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d) onResize(d.width + grows * (e.clientX - d.x));
  }

  function end() {
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    if (e.key === 'ArrowLeft') next = width - grows * KEY_STEP;
    else if (e.key === 'ArrowRight') next = width + grows * KEY_STEP;
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
      aria-orientation="vertical"
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
