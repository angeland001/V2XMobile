import { useCallback, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';

// Positions a vertical stack of sibling overlays from their *real* rendered
// heights instead of guessed pixel gaps, so members don't collide when one
// grows (longer text, larger accessibility font, a different screen size).
//
// `order` must be a stable (module-level) array — each entry is a key
// naming one stack member, outermost-first. Call `onLayout(key)` from that
// member's outermost View, and use `offsetFor(key, base)` for its position
// style. If a member can unmount (conditional render), call
// `resetHeight(key)` when it goes away so later members collapse back down
// instead of leaving a stale gap.
export function useStackedOffset(order: readonly string[], gap: number = 8) {
  const [heights, setHeights] = useState<Record<string, number>>({});

  const onLayout = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
    },
    [],
  );

  const resetHeight = useCallback((key: string) => {
    setHeights((prev) => (!prev[key] ? prev : { ...prev, [key]: 0 }));
  }, []);

  const offsetFor = useCallback(
    (key: string, base: number = 0): number => {
      let offset = base;
      for (const k of order) {
        if (k === key) break;
        offset += (heights[k] ?? 0) + gap;
      }
      return offset;
    },
    [heights, order, gap],
  );

  // Real measured height of one stack member — lets a caller outside the
  // top-down offsetFor chain (e.g. a bottom-anchored sibling that needs to
  // sit just above one specific member) position off the same measurements
  // instead of a guessed constant.
  const heightFor = useCallback(
    (key: string): number => heights[key] ?? 0,
    [heights],
  );

  // Sum of every member's real height plus the gaps between them — lets a
  // caller center the whole stack as one block instead of anchoring it to
  // a fixed edge.
  const totalHeight = useCallback((): number => {
    let total = 0;
    order.forEach((k, i) => {
      total += heights[k] ?? 0;
      if (i < order.length - 1) total += gap;
    });
    return total;
  }, [heights, order, gap]);

  return { onLayout, offsetFor, resetHeight, totalHeight, heightFor };
}

export default useStackedOffset;
