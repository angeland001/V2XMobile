// app/src/features/preemption/hooks/useElapsedSeconds.ts

import { useEffect, useRef, useState } from 'react';

// Seconds elapsed since `since` most recently became active, ticking once
// per second. Resets to 0 whenever `active` goes false. Local React state
// only (setInterval → useState) — not a mobx mutation, so no runInAction
// needed at any call site, same as PreemptionStatusBanner's own
// useRisingEdgeFlash. Shared by PreemptionStatusBanner's elapsed-timer
// readout and PreemptionCountdown's remaining-time calculation — both key
// off the same PreemptionViewModel.grantedAt timestamp.
export function useElapsedSeconds(active: boolean, since: number | null): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!active || since === null) {
      setElapsed(0);
      return;
    }

    setElapsed(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    intervalRef.current = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, since]);

  return elapsed;
}

export default useElapsedSeconds;
