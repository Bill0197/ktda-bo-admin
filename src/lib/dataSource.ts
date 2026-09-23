/* Which pages show live data, and which run on the in-browser demo.

   Live: everything the tokenization service backs — the Tokenization Console,
   and the BO Admin pages whose records it holds. Everything else would come
   from CORE API, which is not deployed, so it runs on src/mock (see
   api.demo.ts) unless the build sets VITE_CORE_API_BASE. */

export const CORE_CONNECTED = Boolean(import.meta.env.VITE_CORE_API_BASE);

/** Route prefixes backed by the tokenization service. Segment-aware: "/clients"
 *  covers "/clients/123" but not "/clients-export". */
const LIVE_ROUTES = ["/token-console"];

export function isLiveRoute(path: string) {
  return LIVE_ROUTES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isDemoRoute(path: string) {
  return !CORE_CONNECTED && !isLiveRoute(path);
}
