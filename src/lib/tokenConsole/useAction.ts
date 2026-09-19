import { useCallback, useEffect, useRef, useState } from "react";

/** One write to the accounting service: pending and error state, and a `run`
 * that resolves to the result, or to undefined when the call failed (the
 * message is then in `error`). The caller decides what a success refreshes. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Something went wrong");
      return undefined;
    } finally {
      if (alive.current) setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
