import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The measured inner width of an element, or 0 before it has been laid out.
 *
 * A `ResizeObserver` rather than a window `resize` listener: the board's
 * container also changes width when something beside it appears or goes away
 * (the weave bar, a report in the file menu), and a window listener sees
 * none of that.
 *
 * 0 is a deliberate initial value and a deliberate fallback: callers treat
 * "unmeasured" as "do not scale", so the first paint and any environment
 * without layout render the board at its natural size instead of guessing.
 */
export function useAvailableWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
