import { useSyncExternalStore } from 'react';

import { subscribe } from './repo';

let version = 0;
let wired = false;

function ensureWired(): void {
  if (wired) return;
  wired = true;
  subscribe(() => {
    version += 1;
  });
}

// Registered before any component subscriber, so the counter is bumped before React re-reads it.
ensureWired();

const getSnapshot = (): number => version;

/** Returns a counter that bumps after every local write or sync merge. */
export function useDbChange(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
