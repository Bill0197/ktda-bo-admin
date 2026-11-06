import { expect, test } from "@playwright/test";

/* The deployed /omni proxy sets omnichannel's institution header
 * (X-Dev-Institution) from its own configuration, never from the browser, and
 * lets the caller read its own institution. No browser is needed: the proxy is
 * called directly and every fetch it makes is recorded. */

const KTDA = "11111111-1111-4111-8111-111111111111";
const FORGED = "00000000-0000-0000-0000-0000000000c0";
const ENV = { OMNI_TARGET: "https://omni.test", TOK_TARGET: "https://engine.test" };

type Call = { url: string; headers: Headers };
type Handler = (ctx: { request: Request; env: Record<string, string> }) => Promise<Response>;

// The Cloudflare Pages proxy for /omni: plain JS with no types, loaded by path.
const PROXY = "../functions/omni/[[path]].js";
const proxy = async () => ((await import(PROXY)) as { onRequest: Handler }).onRequest;

async function call(path: string, opts: { env?: Record<string, string>; method?: string; headers?: Record<string, string> } = {}) {
  const calls: Call[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    // The session check against the engine, then omnichannel itself.
    if (url.endsWith("/api/auth/me")) return new Response(JSON.stringify({ email: "officer@ktda.test" }), { status: 200 });
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const request = new Request(`https://bo.test${path}`, {
      method: opts.method ?? "GET",
      headers: { cookie: "JSESSIONID=abc", ...opts.headers },
    });
    const onRequest = await proxy();
    const res = await onRequest({ request, env: { ...ENV, ...opts.env } });
    return { res, upstream: calls.find((c) => c.url.startsWith(ENV.OMNI_TARGET)) };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("the configured institution is sent, and a browser's own value is never forwarded", async () => {
  const { res, upstream } = await call("/omni/api/operator/bulk-loads", {
    env: { OMNI_INSTITUTION_ID: KTDA },
    headers: { "x-dev-institution": FORGED },
  });
  expect(res.status).toBe(200);
  expect(upstream?.headers.get("x-dev-institution")).toBe(KTDA);
});

test("with no institution configured, no institution header goes at all", async () => {
  const { upstream } = await call("/omni/api/operator/bulk-loads", { headers: { "x-dev-institution": FORGED } });
  expect(upstream).toBeDefined();
  expect(upstream?.headers.has("x-dev-institution")).toBe(false);
});

test("the back office may read its own institution, and nothing else about institutions", async () => {
  const read = await call("/omni/api/operator/institutions", { env: { OMNI_INSTITUTION_ID: KTDA } });
  expect(read.res.status).toBe(200);
  expect(read.upstream?.url).toBe("https://omni.test/api/operator/institutions");

  const settings = await call("/omni/api/operator/institution/settings", { env: { OMNI_INSTITUTION_ID: KTDA } });
  expect(settings.res.status).toBe(200);
  expect(settings.upstream?.headers.get("x-dev-institution")).toBe(KTDA);
  const settingsWrite = await call("/omni/api/operator/institution/settings", { method: "POST" });
  expect(settingsWrite.res.status).toBe(404);

  const other = await call(`/omni/api/operator/institutions/${KTDA}`);
  expect(other.res.status).toBe(404);
  expect(other.upstream).toBeUndefined();

  const write = await call("/omni/api/operator/institutions", { method: "POST" });
  expect(write.res.status).toBe(404);
  expect(write.upstream).toBeUndefined();
});

test("currency exchange, the market and its content are not reachable at all", async () => {
  for (const [method, path] of [
    ["GET", "/omni/api/operator/fx/settings"],
    ["GET", "/omni/api/operator/fx/conversions"],
    ["POST", "/omni/api/operator/fx/settings/changes"],
    ["GET", "/omni/api/operator/market/settings"],
    ["POST", "/omni/api/operator/market/settings/changes"],
    ["GET", "/omni/api/operator/content"],
  ]) {
    const { res, upstream } = await call(path, { method, env: { OMNI_INSTITUTION_ID: KTDA } });
    expect(res.status, `${method} ${path}`).toBe(404);
    expect(upstream, `${method} ${path}`).toBeUndefined();
  }
});
