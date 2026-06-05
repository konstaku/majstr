import { useEffect, useRef, useState } from "react";

// Animates a number from its previous value to a new one with a slot-machine effect:
// rapid changes at first (noisy), slowing down and converging to the target.
export function useSlotCount(target: number | null): number | null {
  const [displayed, setDisplayed] = useState<number | null>(target);
  const prevRef = useRef<number | null>(target);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (target === null) {
      setDisplayed(null);
      prevRef.current = null;
      return;
    }

    // Animate from 0 on initial load (prevRef is null), otherwise from previous value
    const from = prevRef.current !== null ? prevRef.current : 0;
    prevRef.current = target;

    if (from === target) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const diff = target - from;
    // 8 ticks, delays: 12 18 27 41 61 91 137 205 ms → ~590ms total
    const TICKS = 8;
    let cumDelay = 0;

    for (let i = 0; i < TICKS; i++) {
      const isLast = i === TICKS - 1;
      cumDelay += Math.round(12 * Math.pow(1.5, i));

      const progress = (i + 1) / TICKS;
      const eased = 1 - Math.pow(1 - progress, 2);

      let value: number;
      if (isLast) {
        value = target;
      } else if (progress <= 0.5) {
        // Slot machine phase — add noise so it looks like it's spinning
        const noise = Math.round((Math.random() * 2 - 1) * Math.abs(diff) * 0.5);
        value = Math.max(0, Math.round(from + diff * eased) + noise);
      } else {
        // Settling phase — converge cleanly
        value = Math.max(0, Math.round(from + diff * eased));
      }

      const d = cumDelay;
      timersRef.current.push(setTimeout(() => setDisplayed(value), d));
    }

    return () => timersRef.current.forEach(clearTimeout);
  }, [target]);

  return displayed;
}
