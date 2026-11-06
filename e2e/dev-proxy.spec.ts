import { createServer as httpServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

/* The dev server's /omni proxy refuses a caller with no engine session, as
 * functions/omni and nginx's auth_request do. A real Vite dev server runs here
 * against a fake engine and a fake omnichannel on local ports: nothing leaves
 * this machine, and process.env wins over any .env.local target. */

const KTDA = "11111111-1111-4111-8111-111111111111";
const GOOD = "JSESSIONID=good";

type Seen = { url: string; headers: IncomingHttpHeaders };
const omniSeen: Seen[] = [];
let engineDown = false;

const listen = (s: Server) => new Promise<string>((ok) => s.listen(0, "127.0.0.1", () => ok(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)));

const engine = httpServer((req, res) => {
  if (req.url !== "/api/auth/me") { res.statusCode = 404; return res.end(); }
  if (engineDown) { res.statusCode = 502; return res.end(); }
  const ok = req.headers.cookie === GOOD;
  res.statusCode = ok ? 200 : 401;
  res.setHeader("content-type", "application/json");
  res.end(ok ? JSON.stringify({ email: "officer@ktda.test" }) : "{}");
});
const omni = httpServer((req, res) => {
  omniSeen.push({ url: req.url ?? "", headers: req.headers });
  res.setHeader("content-type", "application/json");
  res.end("[]");
});

let vite: ViteDevServer;
let base = "";
const saved = { ...process.env };

test.beforeAll(async () => {
  const [tok, om] = await Promise.all([listen(engine), listen(omni)]);
  Object.assign(process.env, { TOK_TARGET: tok, OMNI_TARGET: om, OMNI_INSTITUTION_ID: KTDA });
  vite = await createServer({ logLevel: "silent", server: { port: 0, strictPort: false, hmr: false } });
  await vite.listen();
  base = `http://localhost:${(vite.httpServer!.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await vite?.close();
  engine.close();
  omni.close();
  for (const k of ["TOK_TARGET", "OMNI_TARGET", "OMNI_INSTITUTION_ID"]) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

test.beforeEach(() => { omniSeen.length = 0; engineDown = false; });

const get = (path: string, headers: Record<string, string> = {}) => fetch(base + path, { headers });

test("signed out (no cookie): 401, and omnichannel is never called", async () => {
  for (const path of ["/omni/api/operator/bulk-loads", "/omni/api/operator/institutions"]) {
    const res = await get(path);
    expect(res.status).toBe(401);
  }
  expect(omniSeen).toEqual([]);
});

test("a cookie the engine does not accept: 401, and omnichannel is never called", async () => {
  const res = await get("/omni/api/operator/institutions", { cookie: "JSESSIONID=stale" });
  expect(res.status).toBe(401);
  expect(omniSeen).toEqual([]);
});

test("an engine that cannot be reached: 503, not a pass", async () => {
  engineDown = true;
  const res = await get("/omni/api/operator/institutions", { cookie: GOOD });
  expect(res.status).toBe(503);
  expect(omniSeen).toEqual([]);
});

test("signed in: the call goes through, named from the session, with no cookie and the configured institution", async () => {
  const res = await get("/omni/api/operator/institutions", { cookie: GOOD, "x-dev-subject": "staff:someone-else@x", "x-dev-institution": "forged" });
  expect(res.status).toBe(200);
  expect(omniSeen).toHaveLength(1);
  const { url, headers } = omniSeen[0];
  expect(url).toBe("/api/operator/institutions");
  expect(headers["x-dev-subject"]).toBe("staff:officer@ktda.test");
  expect(headers["x-dev-institution"]).toBe(KTDA);
  expect(headers.cookie).toBeUndefined();
});
