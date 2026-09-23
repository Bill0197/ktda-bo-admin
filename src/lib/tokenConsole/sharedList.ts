import { useCallback, useEffect, useSyncExternalStore } from "react";

/* One fetch per reference list, shared by every picker that shows it.
 *
 * The product form alone has a dozen pickers, several pointing at the same
 * entity (institution appears under scheme, package, tariff domain and fund),
 * and a create in one of them must show up in all the others. useAsyncData
 * fetches per component, so this keeps one cache entry per key instead and
 * lets a create invalidate it. Lives for the tab; a full reload starts over. */

export type ListSnapshot<T> = { data?: T; isPending: boolean; error?: string };

type Entry = {
  snapshot: ListSnapshot<unknown>;
  fetcher: () => Promise<unknown>;
  inFlight?: Promise<void>;
  listeners: Set<() => void>;
};

const cache = new Map<string, Entry>();

function entryFor(key: string, fetcher: () => Promise<unknown>): Entry {
  let entry = cache.get(key);
  if (!entry) {
    entry = { snapshot: { isPending: true }, fetcher, listeners: new Set() };
    cache.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, snapshot: ListSnapshot<unknown>) {
  entry.snapshot = snapshot;
  for (const l of entry.listeners) l();
}

function load(entry: Entry): Promise<void> {
  if (entry.inFlight) return entry.inFlight;
  // Keep showing the rows we have while refetching; only the first load is "pending".
  if (entry.snapshot.data === undefined) publish(entry, { isPending: true });
  entry.inFlight = entry
    .fetcher()
    .then(
      (data) => publish(entry, { data, isPending: false }),
      (e: unknown) =>
        publish(entry, {
          data: entry.snapshot.data,
          isPending: false,
          error: e instanceof Error ? e.message : "Could not load",
        }),
    )
    .finally(() => {
      entry.inFlight = undefined;
    });
  return entry.inFlight;
}

export function useSharedList<T>(key: string, fetcher: () => Promise<T>) {
  const entry = entryFor(key, fetcher);
  const subscribe = useCallback(
    (onChange: () => void) => {
      entry.listeners.add(onChange);
      return () => entry.listeners.delete(onChange);
    },
    [entry],
  );
  const snapshot = useSyncExternalStore(subscribe, () => entry.snapshot) as ListSnapshot<T>;

  useEffect(() => {
    // First use, or a previous attempt failed: fetch. Otherwise the cached rows stand.
    if (entry.snapshot.data === undefined && !entry.inFlight) void load(entry);
  }, [entry]);

  const reload = useCallback(() => load(entry), [entry]);
  return { ...snapshot, reload };
}

/** Refetch a list after something was created in it. */
export function invalidateList(key: string) {
  const entry = cache.get(key);
  if (entry) void load(entry);
}

/** A shared list in the shape ConsoleTable reads (`Source<T>`). Use the same
 *  key as the entity registry (`tok:<entityKey>`) to share its cache. */
export function useSharedSource<T>(key: string, fetcher: () => Promise<T[]>) {
  const list = useSharedList(key, fetcher);
  return { data: list.data ?? null, loading: list.isPending, error: list.error ?? null, reload: list.reload };
}

/** Forget every cached list — on sign-out, so the next account starts clean. */
export function clearSharedLists() {
  cache.clear();
}
