import { execSync } from "node:child_process";
import { Agent as HttpAgent, request as httpRequest, type IncomingMessage } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// A stamp of the commit this build carries, so the running app can report
// which version is deployed. CI environment variables win over the local
// checkout (a deploy runner knows the exact commit it is shipping); both fall
// back to the working tree, and finally to "dev" when built outside git.
function appVersion() {
  const e = process.env;
  const commit = (e.VITE_COMMIT_SHA || e.GITHUB_SHA || git("rev-parse HEAD")).slice(0, 7) || "dev";
  const ref = e.VITE_COMMIT_REF || e.GITHUB_REF_NAME || git("rev-parse --abbrev-ref HEAD") || "";
  const commitTime = git("show -s --format=%cI HEAD");
  // When this build was produced — i.e. the deploy time, since the build runs
  // as part of `npm run deploy`. Overridable so a reproducible build can pin it.
  const builtAt = e.VITE_BUILD_TIME || new Date().toISOString();
  return { commit, ref, commitTime, builtAt };
}

/* Local twins of functions/tok and functions/omni (the Cloudflare Pages proxies).
   Neither backend sends CORS headers, and the tokenization session is a cookie,
   so every call must be same-origin — and the browser's Origin is dropped,
   as the deployed proxies do.

   TOK_TARGET / OMNI_TARGET pick the backends and have no default: this copy
   came from another back office whose defaults pointed at a shared UAT, and a
   sign-in there writes to that environment. They are read from the
   environment or from an untracked .env.local (any .env file Vite loads; the
   environment wins). Unset, the dev server still runs (the stubbed browser
   tests need nothing more) and every /tok or /omni call answers 503 saying
   which variable to set. `secure: false` because test load balancers often
   present self-signed certificates — acceptable only on a developer machine;
   the deployed proxies cannot do this.

   OMNI_INSTITUTION_ID is the institution this back office works for.
   Omnichannel scopes every operator call to the institution in
   X-Dev-Institution; the proxy sets that header from this value and drops any
   the browser sent, so the browser never chooses it. Unset, no header goes
   and omnichannel falls back to its own default institution. */
type Targets = { tok: string | null; omni: string | null; institution: string | null };

function targetsFor(mode: string): Targets {
  // Only these names are read; none reaches the browser (that needs VITE_).
  const env = loadEnv(mode, process.cwd(), ["TOK_TARGET", "OMNI_TARGET", "OMNI_INSTITUTION_ID"]);
  return {
    tok: env.TOK_TARGET?.trim() || null,
    omni: env.OMNI_TARGET?.trim() || null,
    institution: env.OMNI_INSTITUTION_ID?.trim() || null,
  };
}

/* One pooled, kept-alive connection set per backend. Without it every proxied
   request pays a fresh TLS handshake to the load balancer, which on UAT is most
   of its cost — a page that fans out (Orders reads every offering's book) queued
   up to 8 s per request. */
const pool = (target: string) =>
  target.startsWith("https:") ? new HttpsAgent({ keepAlive: true, maxSockets: 64 }) : new HttpAgent({ keepAlive: true, maxSockets: 64 });

/** Answers /tok and /omni with 503 when their target is not set, so a call
 *  never goes anywhere by default. */
function unsetTargets({ tok, omni, institution }: Targets): Plugin {
  const missing: [string, string][] = [];
  if (!tok) missing.push(["/tok/", "TOK_TARGET"]);
  if (!omni) missing.push(["/omni/", "OMNI_TARGET"]);
  return {
    name: "unset-proxy-targets",
    configureServer(server) {
      if (missing.length) {
        server.config.logger.warn(`Dev proxy: ${missing.map(([, v]) => v).join(" and ")} not set; those calls will answer 503.`);
      }
      if (omni && !institution) {
        server.config.logger.warn(
          "Dev proxy: OMNI_INSTITUTION_ID not set; omnichannel calls carry no institution, so omnichannel answers for its default institution, not this back office's.",
        );
      }
      server.middlewares.use((req, res, next) => {
        const hit = missing.find(([prefix]) => req.url?.startsWith(prefix));
        if (!hit) return next();
        res.statusCode = 503;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: `The dev proxy has no target for ${hit[0]}. Set ${hit[1]} (environment or .env.local) and restart the dev server.` }));
      });
    },
  };
}

/* The sign-in gate in front of /omni, as functions/omni and nginx's
   auth_request have it: omnichannel on UAT checks no token, so nothing goes
   to it unless the caller holds a live engine session. The engine's
   GET /api/auth/me decides, with the caller's cookie: 2xx lets the call
   through, anything else answers 401, and an engine that cannot be reached
   answers 503. The audit name omnichannel records (x-dev-subject) is set from
   that session, never from the browser. */
type Session = { email: string | null } | false | null;

function engineSession(tok: string, agent: HttpAgent | HttpsAgent, cookie: string | undefined): Promise<Session> {
  if (!cookie) return Promise.resolve(false);
  const url = new URL("/api/auth/me", tok);
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve) => {
    const req = send(url, { method: "GET", agent, headers: { cookie, accept: "application/json" }, rejectUnauthorized: false, timeout: 15000 }, (res: IncomingMessage) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => { body += c; });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        if (status >= 500) return resolve(null);
        if (status < 200 || status >= 300) return resolve(false);
        try {
          const me = JSON.parse(body) as { email?: unknown };
          resolve({ email: typeof me.email === "string" ? me.email : null });
        } catch {
          resolve({ email: null });
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}

function omniSessionGate({ tok, omni }: Targets, tokAgent: HttpAgent | HttpsAgent | null): Plugin {
  return {
    name: "omni-session-gate",
    configureServer(server) {
      if (!omni) return;
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/omni/")) return next();
        const answer = (status: number, error: string) => {
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify({ error }));
        };
        if (!tok || !tokAgent) return answer(503, "The dev proxy checks the engine session before any omnichannel call. Set TOK_TARGET and restart the dev server.");
        const session = await engineSession(tok, tokAgent, req.headers.cookie);
        if (session === null) return answer(503, "The engine cannot be reached to check the session. Please try again shortly.");
        if (!session) return answer(401, "Sign in to the back office first.");
        delete req.headers["x-dev-subject"];
        if (session.email) req.headers["x-dev-subject"] = `staff:${session.email}`;
        next();
      });
    },
  };
}

function proxyFor({ tok: TOK_TARGET, omni: OMNI_TARGET, institution }: Targets, tokAgent: HttpAgent | HttpsAgent | null): Record<string, ProxyOptions> {
  const proxy: Record<string, ProxyOptions> = {};
  if (TOK_TARGET && tokAgent) {
    // Anchored with a trailing slash: Vite matches keys as plain prefixes,
    // and a bare "/tok" would also swallow /tokenization/* and /token-console/*.
    proxy["^/tok/"] = {
      target: TOK_TARGET,
      agent: tokAgent,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/tok/, "/api"),
      // Same rule as functions/tok: a 401's anonymous-session cookie would
      // clobber a session established a moment earlier.
      configure: (p) => {
        p.on("proxyReq", (req) => req.removeHeader("origin"));
        p.on("proxyRes", (res) => {
          if (res.statusCode === 401) delete res.headers["set-cookie"];
        });
      },
    };
  }
  if (OMNI_TARGET) {
    proxy["^/omni/api/operator/"] = {
      target: OMNI_TARGET,
      agent: pool(OMNI_TARGET),
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/omni/, ""),
      // Investing features KTDA does not offer (currency exchange, the market
      // and its content): refused here as in functions/omni and nginx.
      bypass: (req) => (/^\/omni\/api\/operator\/(fx|market|content)(\/|\?|$)/.test(req.url ?? "") ? false : undefined),
      // Omnichannel's CORS list is localhost:5173-5178 only and it 403s any
      // other Origin — same-origin needs none, so drop it (as functions/omni does).
      configure: (p) => {
        p.on("proxyReq", (req) => {
          req.removeHeader("origin");
          // The engine session is for the gate above, not for omnichannel.
          req.removeHeader("cookie");
          // The institution is this server's to say, never the browser's.
          req.removeHeader("x-dev-institution");
          if (institution) req.setHeader("X-Dev-Institution", institution);
        });
      },
    };
  }
  return proxy;
}

export default defineConfig(({ mode }) => {
  const targets = targetsFor(mode);
  const tokAgent = targets.tok ? pool(targets.tok) : null;
  return {
    // Where the app is served. "/" in dev and on Cloudflare Pages (its own
    // origin); on the UAT EC2 box it is served under a path prefix behind the
    // shared ALB (e.g. /admin/), so the build is told that base and every asset
    // URL carries it. React Router reads the same value (import.meta.env.BASE_URL)
    // for its basename — see src/main.tsx.
    base: process.env.VITE_BASE || "/",
    plugins: [react(), tailwindcss(), unsetTargets(targets), omniSessionGate(targets, tokAgent)],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion()),
    },
    server: {
      port: 5174,
      proxy: proxyFor(targets, tokAgent),
    },
  };
});
