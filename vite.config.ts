import { execSync } from "node:child_process";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { defineConfig } from "vite";
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

   TOK_TARGET / OMNI_TARGET pick the backends (default: UAT). `secure: false`
   because the UAT load balancers present self-signed certificates — acceptable
   only on a developer machine; the deployed proxies cannot do this. */
const TOK_TARGET = process.env.TOK_TARGET ?? "https://tokenization-engine-lb-2030238964.us-east-1.elb.amazonaws.com";
const OMNI_TARGET = process.env.OMNI_TARGET ?? "https://tokenization-omnichannel-lb-1369560458.us-east-1.elb.amazonaws.com";

/* One pooled, kept-alive connection set per backend. Without it every proxied
   request pays a fresh TLS handshake to the load balancer, which on UAT is most
   of its cost — a page that fans out (Orders reads every offering's book) queued
   up to 8 s per request. */
const pool = (target: string) =>
  target.startsWith("https:") ? new HttpsAgent({ keepAlive: true, maxSockets: 64 }) : new HttpAgent({ keepAlive: true, maxSockets: 64 });

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  server: {
    port: 5174,
    proxy: {
      // Anchored with a trailing slash: Vite matches keys as plain prefixes,
      // and a bare "/tok" would also swallow /tokenization/* and /token-console/*.
      "^/tok/": {
        target: TOK_TARGET,
        agent: pool(TOK_TARGET),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tok/, "/api"),
        // Same rule as functions/tok: a 401's anonymous-session cookie would
        // clobber a session established a moment earlier.
        configure: (proxy) => {
          proxy.on("proxyReq", (req) => req.removeHeader("origin"));
          proxy.on("proxyRes", (res) => {
            if (res.statusCode === 401) delete res.headers["set-cookie"];
          });
        },
      },
      "^/omni/api/operator/": {
        target: OMNI_TARGET,
        agent: pool(OMNI_TARGET),
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/omni/, ""),
        // Omnichannel's CORS list is localhost:5173-5178 only and it 403s any
        // other Origin — same-origin needs none, so drop it (as functions/omni does).
        configure: (proxy) => {
          proxy.on("proxyReq", (req) => req.removeHeader("origin"));
        },
      },
    },
  },
});
