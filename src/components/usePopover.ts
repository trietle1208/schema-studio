import { useEffect, useRef, useState } from 'react';

/** A popover that closes on Esc and on a press outside it: `[open, setOpen, ref]`, where `ref` goes on the element that holds the trigger and the popover. */
export function usePopover(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return [open, setOpen, ref] as const;
}
