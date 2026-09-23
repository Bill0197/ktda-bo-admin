import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* Local twins of functions/tok and functions/omni (the Cloudflare Pages proxies).
   Neither backend sends CORS headers, and the tokenization session is a cookie,
   so every call must be same-origin.

   TOK_TARGET / OMNI_TARGET pick the backends (default: UAT). `secure: false`
   because the UAT load balancers present self-signed certificates — acceptable
   only on a developer machine; the deployed proxies cannot do this. */
const TOK_TARGET = process.env.TOK_TARGET ?? "https://tokenization-web-lb-1075088900.us-east-1.elb.amazonaws.com";
const OMNI_TARGET = process.env.OMNI_TARGET ?? "https://tokenization-omnichannel-lb-1369560458.us-east-1.elb.amazonaws.com";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/tok": {
        target: TOK_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tok/, "/api"),
      },
      "/omni/api/operator": {
        target: OMNI_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/omni/, ""),
      },
    },
  },
});
