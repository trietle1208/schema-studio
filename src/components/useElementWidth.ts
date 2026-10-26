import { useEffect, useState, type RefObject } from 'react';

/**
 * The width of an element's content box, kept as the element is resized: the real room a layout has,
 * not the window's. 0 until it is first measured, which is before the first paint.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
