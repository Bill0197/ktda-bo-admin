// /omni/* on Cloudflare Pages -> omnichannel's staff (/api/operator/*) endpoints.
// The deployed twin of the /omni dev proxy in vite.config.ts.
//
// Only the operator surface is reachable through here, and only the calls
// BO Admin makes (ALLOWED): BO Admin has no business
// calling a customer's /api/me/* on their behalf, and on UAT omnichannel runs
// open (no token), so an unrestricted proxy would hand that surface to anyone.
//
// Same certificate caveat as functions/tok: 503 until the load balancer has a
// trusted certificate or OMNI_TARGET points at a host that has one.
const UPSTREAM = "https://tokenization-omnichannel-lb-1369560458.us-east-1.elb.amazonaws.com";
// Must match functions/tok — the session this proxy checks lives there.
const TOK_UPSTREAM = "https://tokenization-engine-lb-2030238964.us-east-1.elb.amazonaws.com";

const UUID = "[0-9a-fA-F-]+";
// What each method may reach: actions on an investor record, and compliance's
// identity checks (the registry mismatches, the photo queue, one photo, a decision).
const ALLOWED = {
  POST: new RegExp(`^/omni/api/operator/(link-codes|notifications|investors/${UUID}/kyc-status|onboarding/documents/${UUID}/review)$`),
  GET: new RegExp(`^/omni/api/operator/(onboarding/(applications|documents|documents/${UUID}/content)|customers|customers/${UUID}(/(timeline|messages|activity))?)$`),
};
const FORWARDED = ["accept", "content-type", "authorization"];
// Lists are paged: the totals travel in these headers, the body stays an array.
const PASSED_BACK = ["content-type", "x-total-count", "x-page", "x-size", "x-total-pages"];

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const allowed = ALLOWED[request.method];
  if (!allowed || !allowed.test(url.pathname)) {
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
  // Omnichannel's audit (reviewedBy) names who acted. UAT takes it from this
  // header; it is set here from the verified session, never from the browser.
  if (session.email) headers.set("x-dev-subject", `staff:${session.email}`);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
      redirect: "manual",
    });
  } catch {
    return unavailable();
  }
  if (upstream.status >= 520 && upstream.status <= 530) return unavailable();

  const out = new Headers();
  for (const name of PASSED_BACK) {
    const value = upstream.headers.get(name);
    if (value !== null) out.set(name, value);
  }
  out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/** The signed-in staff member ({email}) of a live tokenization session, false
 *  without one; null when that service itself cannot be reached (so the
 *  caller answers 503, not 401). */
async function signedIn(request, env) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return false;
  try {
    const res = await fetch((env.TOK_TARGET || TOK_UPSTREAM) + "/api/auth/me", { headers: { cookie } });
    if (res.status >= 520 && res.status <= 530) return null;
    if (!res.ok) return false;
    const me = await res.json().catch(() => ({}));
    return { email: typeof me.email === "string" ? me.email : null };
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
