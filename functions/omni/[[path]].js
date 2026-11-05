// /omni/* on Cloudflare Pages -> omnichannel's staff (/api/operator/*) endpoints.
// The deployed twin of the /omni dev proxy in vite.config.ts.
//
// Only the operator surface is reachable through here, and only the calls
// BO Admin makes (ALLOWED): BO Admin has no business
// calling a customer's /api/me/* on their behalf, and on UAT omnichannel runs
// open (no token), so an unrestricted proxy would hand that surface to anyone.
//
// Omnichannel is the Pages environment variable OMNI_TARGET, and the session
// this proxy checks lives on the engine at TOK_TARGET (the one functions/tok
// uses). Neither has a default: until both are set every call answers 503
// saying so. Same certificate caveat as functions/tok.

const UUID = "[0-9a-fA-F-]+";
// What each method may reach: actions on an investor record, and compliance's
// identity checks (the registry mismatches, the photo queue, one photo, a decision),
// the Customer desk (and suspending a profile, proposing to reinstate or close one,
// and the approvals of those proposals), re-screening
// and the closure requests in Support, the Transactions page and its payment issues
// (retry, resolve, match, unmatched), and the Market page (the dealing settings and
// their change log, a proposal, an approval or a rejection), and Reports and
// Surveillance (the CSV reports, the alert queue with assign and close, and the
// snapshot and rule runs), and the bulk onboarding and payment runs (a CSV
// upload, Process, the run, the recent runs, its reconciliation, and whether
// onboarding has completed for an institution).
const ALLOWED = {
  POST: new RegExp(`^/omni/api/operator/(link-codes|notifications|investors/${UUID}/kyc-status|onboarding/documents/${UUID}/review|onboarding/applications/rescreen|customers/${UUID}/(suspend|reinstate|close)|customers/interventions/${UUID}/(approve|reject)|payments/${UUID}/(retry|resolve|match|unmatched)|market/settings/changes|market/settings/changes/${UUID}/(approve|reject)|fx/settings/changes|fx/settings/changes/${UUID}/(approve|reject)|reporting/alerts/${UUID}/(assign|close)|reporting/runs/(snapshot|surveillance)|bulk-loads/upload|bulk-loads/${UUID}/process)$`),
  GET: new RegExp(`^/omni/api/operator/(onboarding/(applications|applications/screening-hits|documents|documents/${UUID}/content)|support/tickets|customers|customers/interventions|customers/${UUID}(/(timeline|messages|activity|interventions))?|transactions|transactions/summary|payments/issues|market/settings|market/settings/changes|fx/settings|fx/settings/changes|fx/conversions|reporting/reports/(transactions|holdings|token-supply|suspicious-activity)\\.csv|reporting/alerts|reporting/alerts/${UUID}|reporting/runs|bulk-loads|bulk-loads/onboarding-status|bulk-loads/${UUID}(/reconciliation)?)$`),
};
const FORWARDED = ["accept", "content-type", "authorization"];
// Lists are paged: the totals travel in these headers, the body stays an array.
// x-truncated: the payment issues queue was cut at omnichannel's cap.
// content-disposition: a report's file name.
const PASSED_BACK = ["content-type", "content-disposition", "x-total-count", "x-page", "x-size", "x-total-pages", "x-truncated"];

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const allowed = ALLOWED[request.method];
  if (!allowed || !allowed.test(url.pathname)) {
    return json(404, { error: "Not found." });
  }
  if (!env.OMNI_TARGET || !env.TOK_TARGET) {
    return json(503, { error: "This site has no omnichannel or engine configured yet (OMNI_TARGET, TOK_TARGET)." });
  }
  // UAT omnichannel checks no token, so this proxy is the only gate: forward
  // nothing unless the caller holds a live BO Admin (tokenization) session.
  const session = await signedIn(request, env);
  if (session === null) return unavailable();
  if (!session) return json(401, { error: "Sign in to the back office first." });

  const target = env.OMNI_TARGET + url.pathname.replace(/^\/omni/, "") + url.search;

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
    const res = await fetch(env.TOK_TARGET + "/api/auth/me", { headers: { cookie } });
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
