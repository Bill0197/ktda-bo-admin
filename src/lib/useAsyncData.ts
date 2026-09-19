import { useCallback, useEffect, useRef, useState } from "react";

/** Fetch-on-mount with loading/error state and an unmount guard, so pages
 * get Skeleton/error rendering instead of the bare `getX().then(setX)`
 * pattern (which leaves no loading state and rejects unhandled). */
export function useAsyncData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const aliveRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (aliveRef.current) setData(result);
    } catch (e) {
      if (aliveRef.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void reload();
    return () => {
      aliveRef.current = false;
    };
  }, [reload]);

  return { data, loading, error, reload, setData };
}
