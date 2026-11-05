import { execSync } from "node:child_process";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { defineConfig, type Plugin, type ProxyOptions } from "vite";
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
   sign-in there writes to that environment. Unset, the dev server still runs
   (the stubbed browser tests need nothing more) and every /tok or /omni call
   answers 503 saying which variable to set. `secure: false` because test load
   balancers often present self-signed certificates — acceptable only on a
   developer machine; the deployed proxies cannot do this. */
const TOK_TARGET = process.env.TOK_TARGET?.trim() || null;
const OMNI_TARGET = process.env.OMNI_TARGET?.trim() || null;

/* One pooled, kept-alive connection set per backend. Without it every proxied
   request pays a fresh TLS handshake to the load balancer, which on UAT is most
   of its cost — a page that fans out (Orders reads every offering's book) queued
   up to 8 s per request. */
const pool = (target: string) =>
  target.startsWith("https:") ? new HttpsAgent({ keepAlive: true, maxSockets: 64 }) : new HttpAgent({ keepAlive: true, maxSockets: 64 });

/** Answers /tok and /omni with 503 when their target is not set, so a call
 *  never goes anywhere by default. */
function unsetTargets(): Plugin {
  const missing: [string, string][] = [];
  if (!TOK_TARGET) missing.push(["/tok/", "TOK_TARGET"]);
  if (!OMNI_TARGET) missing.push(["/omni/", "OMNI_TARGET"]);
  return {
    name: "unset-proxy-targets",
    configureServer(server) {
      if (missing.length) {
        server.config.logger.warn(`Dev proxy: ${missing.map(([, v]) => v).join(" and ")} not set; those calls will answer 503.`);
      }
      server.middlewares.use((req, res, next) => {
        const hit = missing.find(([prefix]) => req.url?.startsWith(prefix));
        if (!hit) return next();
        res.statusCode = 503;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: `The dev proxy has no target for ${hit[0]}. Set ${hit[1]} and restart the dev server.` }));
      });
    },
  };
}

const proxy: Record<string, ProxyOptions> = {};
if (TOK_TARGET) {
  // Anchored with a trailing slash: Vite matches keys as plain prefixes,
  // and a bare "/tok" would also swallow /tokenization/* and /token-console/*.
  proxy["^/tok/"] = {
    target: TOK_TARGET,
    agent: pool(TOK_TARGET),
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
    // Omnichannel's CORS list is localhost:5173-5178 only and it 403s any
    // other Origin — same-origin needs none, so drop it (as functions/omni does).
    configure: (p) => {
      p.on("proxyReq", (req) => req.removeHeader("origin"));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), unsetTargets()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  server: {
    port: 5174,
    proxy,
  },
});
