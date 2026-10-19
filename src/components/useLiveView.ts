import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { View } from '../core/layout';

/** How long after the last step of a pan or zoom, once the layer has got there, the view is handed back to React. */
const SETTLE_MS = 60;
/**
 * How long the layer stays on its own compositing layer once the view is handed back. Letting it go
 * draws the whole diagram again, sharp, and so does taking it up again: a wheel that is turned a
 * notch at a time would do both between every two notches.
 */
const SHARPEN_MS = 400;
const EASE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
/** Gentler at the start than `EASE`: a long glide that the next notch of a wheel takes over before it has stopped. */
export const SMOOTH_EASE = 'cubic-bezier(0.5, 1, 0.89, 1)';

/** The `transform` that puts a view on the canvas layer. */
export function viewTransform({ offset, zoom }: View): string {
  return `translate(${offset.x}px,${offset.y}px) scale(${zoom})`;
}

/**
 * The view of a canvas while it is panned or zoomed. A wheel or a drag makes dozens of steps a
 * second, and a render of the whole canvas for each is what made them stutter. Setting the layer's
 * `transform` from script for each step is not enough either: the browser then lays out its
 * compositing layers again on every frame, which takes longer than a frame for a few hundred rows.
 * So each step starts an animation of the layer from where it is now to where the step puts it,
 * which the compositor runs by itself, and which glides over the jumps of a wheel that turns in
 * notches. The view is handed to `commit` (which sets the state) once the steps stop and the layer
 * has got there, and every `commitEvery` ms while they go on when that is given (a large diagram,
 * which draws only the tables near the view). The layer is promoted to its own compositing layer
 * while it moves, and let go of afterwards so that the text is drawn sharp at the zoom it settled on.
 *
 * `view` is the committed view; `live.current` is the one the layer is on its way to.
 */
export function useLiveView(view: View, commit: (view: View) => void, commitEvery: number | null = null) {
  /** Goes on the element that `viewTransform` is for. */
  const layer = useRef<HTMLDivElement>(null);
  const live = useRef(view);
  /** Whether steps are in flight, the frame and the timer that are waiting for them, and when the view was last handed back. */
  const moving = useRef(false);
  const frame = useRef(0);
  const timer = useRef(0);
  const sharpenTimer = useRef(0);
  const committedAt = useRef(0);
  /** How long the animation of the coming frame takes and how it eases, and the animation that is running. */
  const glide = useRef(0);
  const ease = useRef(EASE);
  const animation = useRef<Animation | null>(null);
  const latest = useRef({ commit, commitEvery });
  useLayoutEffect(() => {
    latest.current = { commit, commitEvery };
    // A view that is set from outside (Fit, the toolbar, the minimap) is the one to show, unless a step is in flight.
    if (!moving.current) live.current = view;
  });

  const draw = useCallback(() => {
    frame.current = 0;
    const el = layer.current;
    if (!el) return;
    const to = viewTransform(live.current);
    if (typeof el.animate !== 'function') {
      el.style.transform = to;
      return;
    }
    // From where the running animation has got to, so that a new step does not make the layer jump.
    const from = animation.current ? getComputedStyle(el).transform : el.style.transform;
    animation.current?.cancel();
    animation.current = el.animate([{ transform: from }, { transform: to }], { duration: glide.current, easing: ease.current, fill: 'forwards' });
  }, []);

  const settle = useCallback(() => {
    if (!moving.current) return;
    moving.current = false;
    cancelAnimationFrame(frame.current);
    clearTimeout(timer.current);
    frame.current = 0;
    const el = layer.current;
    if (el) {
      // The layer's own transform takes over where the animation ends, in the same frame: nothing moves.
      el.style.transform = viewTransform(live.current);
      animation.current?.cancel();
      sharpenTimer.current = window.setTimeout(() => layer.current?.style.removeProperty('will-change'), SHARPEN_MS);
    }
    animation.current = null;
    latest.current.commit(live.current);
  }, []);

  /** Moves the view to `next`, the layer gliding there in `ms`. */
  const move = useCallback(
    (next: View, ms: number, easing = EASE) => {
      live.current = next;
      const now = performance.now();
      if (!moving.current) {
        moving.current = true;
        committedAt.current = now;
        clearTimeout(sharpenTimer.current);
        layer.current?.style.setProperty('will-change', 'transform');
      }
      glide.current = ms;
      ease.current = easing;
      if (!frame.current) frame.current = requestAnimationFrame(draw);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(settle, ms + SETTLE_MS);
      const every = latest.current.commitEvery;
      if (every !== null && now - committedAt.current >= every) {
        committedAt.current = now;
        latest.current.commit(next);
      }
    },
    [draw, settle],
  );

  // A canvas that goes away while it moves leaves no timer behind.
  useEffect(
    () => () => {
      moving.current = false;
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
      clearTimeout(sharpenTimer.current);
    },
    [],
  );

  return { layer, live, move, settle };
}
