# Deploying BO Admin to the UAT EC2 box

BO Admin replaces tokenization-web on the UAT box (3.226.168.177, the only target behind the
tokenization-web load balancer). It is served the same way: nginx
serves the built app and forwards API calls to the services on the same box, so there is no
CORS, and the engine's session cookie works as it does for tokenization-web today.

| Browser calls | nginx forwards to |
|---|---|
| `/tok/*` | the accounting engine, `127.0.0.1:8086/api/*` |
| `/omni/api/operator/*` (POST only, signed-in staff only) | omnichannel, `127.0.0.1:8087/api/operator/*` |
| `/omni/api/operator/onboarding/{applications,documents,documents/<id>/content}` (GET only, signed-in staff only) | the same, for the Identity checks page |
| `/omni/api/operator/customers`, `/customers/<id>` and `/customers/<id>/{timeline,messages,activity}` (GET only, signed-in staff only) | the same, for the Customer desk |
| anything else | the app (`/var/www/bo-admin`, falling back to `index.html`) |

The build needs no environment variables.

## Deploy

**Option A — GitHub Actions.** *Actions → Deploy to EC2 → Run workflow.* Tick
**Disable tokenization-web's site** the first time (see below). It builds, deploys to the box and
runs the smoke check. Pushing to `main` does not
deploy — it only runs when started by hand.

Needs the repository secret tokenization-web's deploy uses:

```
gh secret set UAT_EC2_SSH_KEY < uniapp1.pem            # box1, 3.226.168.177
```

**Option B — by hand**, from the `bo-admin` folder:

```
deploy/deploy.sh 3.226.168.177 ~/keys/uniapp1.pem
```

Either way it ends with a smoke check on the box: `GET /` must be `200` and
`GET /tok/auth/me` must be `401` (nginx reaches the engine, nobody is signed in).

## First deploy: replacing tokenization-web

Both apps claim port 80 as nginx's default site, so they can't run side by side. The first
deploy must be told to take over (the checkbox, or `--replace-tokenization-web`). It then
**renames** `/etc/nginx/conf.d/tokenization-web.conf` to `.disabled` — nothing is deleted.
Without the flag, provisioning stops and says so.

To roll back: rename that file back, remove `/etc/nginx/conf.d/bo-admin.conf`, and
`sudo systemctl reload nginx`.

## What `provision.sh` does (idempotent)

Installs nginx if missing, removes the stock default server once (backup at
`nginx.conf.orig`), installs `nginx/bo-admin.conf`, creates `/var/www/bo-admin` and labels it
for SELinux, turns on `httpd_can_network_connect` (without it the proxies return 502), opens
port 80 in firewalld if it's running, then `nginx -t` and enables nginx.

## Prerequisites

- The engine (`8086`) and omnichannel (`8087`) running on the box. If the engine is down the
  app loads but every call returns 502.
- nginx built with `http_auth_request_module` — the RHEL package is. It gates the omnichannel
  calls: on UAT omnichannel checks no token itself, so nginx only forwards a call when the
  engine confirms the caller's session.

## Certificate

The load balancer still presents its self-signed certificate, so users see the browser's
"not secure" warning once and click through — the same as with tokenization-web today. A real
certificate on a real hostname removes it; nothing in this setup needs to change for that.

## Checked before hand-off

The config was run locally with nginx against live UAT: all 79 BO Admin pages load and sign-in
holds; a signed-out omnichannel call gets 401 and a signed-in one reaches omnichannel, with the
browser's `Origin` and cookie removed; a 401 from the engine carries no `Set-Cookie`.
