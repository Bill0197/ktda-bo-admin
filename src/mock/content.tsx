import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getContentBlocks } from "./api";
import type { ContentApp, ContentBlock } from "./fixtures/cms";

type ContentState = { blocks: Map<string, ContentBlock>; loading: boolean; reload: () => void };

const ContentCtx = createContext<ContentState>({ blocks: new Map(), loading: true, reload: () => {} });

/** Scopes every app strictly to its own content blocks — no cross-app
 * sharing. Each app manages every string it shows, including things like
 * the regulatory footer line, independently; editing one app's copy in the
 * CMS never touches another app's. Wrap each app's <App/> in this once, at
 * the top — CMS edits then reach that app's consumers within a poll cycle,
 * the same "live within ~60s" promise the CMS UI already makes. */
export function ContentProvider({ app, children }: { app: ContentApp; children: ReactNode }) {
  const [blocks, setBlocks] = useState<Map<string, ContentBlock>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getContentBlocks().then((all) => {
      if (cancelled) return;
      const scoped = all.filter((b) => b.app === app && b.status === "published");
      setBlocks(new Map(scoped.map((b) => [`${b.app}.${b.key}`, b])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [app, tick]);

  const value = useMemo(() => ({ blocks, loading, reload: () => setTick((t) => t + 1) }), [blocks, loading]);

  return <ContentCtx.Provider value={value}>{children}</ContentCtx.Provider>;
}

/** Reads one field from a published content block, falling back to the
 * hardcoded default when the CMS has no override (or hasn't loaded yet) —
 * so a missing/draft block never blanks out the UI. */
export function useContentField<T = string>(blockKey: string, field: string, fallback: T): T {
  const { blocks } = useContext(ContentCtx);
  for (const b of blocks.values()) {
    if (b.key === blockKey && field in b.value) return (b.value[field] as T) ?? fallback;
  }
  return fallback;
}
