// /tok/* on Cloudflare Pages -> the tokenization (accounting) service's /api/*.
// The deployed twin of the /tok dev proxy in vite.config.ts.
//
// Same origin as the app on purpose: the service sends no CORS headers and its
// session is a JSESSIONID cookie (SameSite=Lax), so a cross-origin call from
// pages.dev would be blocked before authentication is even considered. The
// browser's Origin is dropped for the same reason.
//
// UAT serves a self-signed certificate, which Cloudflare refuses (526) and a
// Worker cannot override. Until the load balancer has a trusted certificate
// (or TOK_TARGET points at a host that has one) this answers 503 with a message
// the app shows as it stands; no redeploy is needed once that is fixed.
const UPSTREAM = "https://tokenization-web-lb-1075088900.us-east-1.elb.amazonaws.com";

const FORWARDED = ["accept", "content-type", "cookie"];

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const target = (env.TOK_TARGET || UPSTREAM) + url.pathname.replace(/^\/tok/, "/api") + url.search;

  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
  } catch {
    return unavailable();
  }
  // 52x: Cloudflare could not complete TLS with, or reach, the origin.
  if (upstream.status >= 520 && upstream.status <= 530) return unavailable();

  const out = new Headers();
  for (const name of ["content-type", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value !== null) out.set(name, value);
  }
  // The session cookie must land on THIS origin. Strip any Domain the service
  // might name and mark it Secure: pages.dev is https-only.
  for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
    out.append("set-cookie", rewriteCookie(cookie));
  }
  out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

function rewriteCookie(cookie) {
  const parts = cookie
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && !/^domain=/i.test(p) && !/^secure$/i.test(p));
  parts.push("Secure");
  return parts.join("; ");
}

function unavailable() {
  return new Response(
    JSON.stringify({ error: "The tokenization service is unreachable from this site right now. Please try again shortly." }),
    { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
