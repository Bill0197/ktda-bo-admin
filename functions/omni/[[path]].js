// /omni/* on Cloudflare Pages -> omnichannel's staff (/api/operator/*) endpoints.
// The deployed twin of the /omni dev proxy in vite.config.ts.
//
// Only the operator surface is reachable through here: BO Admin has no business
// calling a customer's /api/me/* on their behalf, and on UAT omnichannel runs
// open (no token), so an unrestricted proxy would hand that surface to anyone.
//
// Same certificate caveat as functions/tok: 503 until the load balancer has a
// trusted certificate or OMNI_TARGET points at a host that has one.
const UPSTREAM = "https://tokenization-omnichannel-lb-1369560458.us-east-1.elb.amazonaws.com";
// Must match functions/tok — the session this proxy checks lives there.
const TOK_UPSTREAM = "https://tokenization-engine-lb-2030238964.us-east-1.elb.amazonaws.com";

const ALLOWED = /^\/omni\/api\/operator\/(link-codes|notifications|investors\/[0-9a-fA-F-]+\/kyc-status)$/;
const FORWARDED = ["accept", "content-type", "authorization"];

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (request.method !== "POST" || !ALLOWED.test(url.pathname)) {
    return json(404, { error: "Not found." });
  }
  // UAT omnichannel checks no token, so this proxy is the only gate: forward
  // nothing unless the caller holds a live BO Admin (tokenization) session.
  const session = await signedIn(request, env);
  if (session === null) return unavailable();
  if (!session) return json(401, { error: "Sign in to BO Admin first." });

  const target = (env.OMNI_TARGET || UPSTREAM) + url.pathname.replace(/^\/omni/, "") + url.search;

  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  let upstream;
  try {
    upstream = await fetch(target, { method: "POST", headers, body: request.body, redirect: "manual" });
  } catch {
    return unavailable();
  }
  if (upstream.status >= 520 && upstream.status <= 530) return unavailable();

  const out = new Headers();
  const type = upstream.headers.get("content-type");
  if (type !== null) out.set("content-type", type);
  out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/** true/false for a signed-in tokenization session; null when that service
 *  itself cannot be reached (so the caller answers 503, not 401). */
async function signedIn(request, env) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return false;
  try {
    const res = await fetch((env.TOK_TARGET || TOK_UPSTREAM) + "/api/auth/me", { headers: { cookie } });
    if (res.status >= 520 && res.status <= 530) return null;
    return res.ok;
  } catch {
    return null;
  }
}

function unavailable() {
  return json(503, { error: "The omnichannel service is unreachable from this site right now. Please try again shortly." });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
