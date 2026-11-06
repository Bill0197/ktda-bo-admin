#!/usr/bin/env bash
# Build the KTDA Back Office and ship it to the UAT EC2 box by hand — the same
# steps the "Deploy to EC2" GitHub workflow runs, for when you'd rather run them
# yourself (or the box is reachable only from your machine, e.g. via EC2
# Instance Connect rather than a key the Actions runner holds).
#
# Usage (from the repo root):
#   deploy/deploy.sh <host> <ssh-key.pem>
#   e.g. deploy/deploy.sh 3.226.168.177 ~/keys/uat.pem
#
# Serves the SPA under /admin/ on port 8185 and proxies the engine (8086) and
# omnichannel (8087) on localhost. See deploy/README.md.
set -euo pipefail

HOST="${1:?usage: deploy/deploy.sh <host> <ssh-key.pem>}"
KEY="${2:?usage: deploy/deploy.sh <host> <ssh-key.pem>}"

USER_AT="ec2-user@${HOST}"
WEBROOT=/var/www/ktda-bo-admin
PORT=8185
PREFIX=/admin
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes "$USER_AT")
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes)

cd "$(dirname "$0")/.."

echo "==> Building (base ${PREFIX}/)"
npm ci
VITE_BASE="${PREFIX}/" VITE_TOK_BASE="${PREFIX}/tok" VITE_OMNI_BASE="${PREFIX}/omni" npm run build

echo "==> Provisioning ${HOST}"
"${SCP[@]}" deploy/nginx/ktda-bo-admin.conf   "${USER_AT}:/tmp/ktda-bo-admin.conf"
"${SCP[@]}" deploy/provision-ktda-bo-admin.sh "${USER_AT}:/tmp/provision-ktda-bo-admin.sh"
"${SSH[@]}" "chmod +x /tmp/provision-ktda-bo-admin.sh && /tmp/provision-ktda-bo-admin.sh"

echo "==> Syncing the build to ${WEBROOT}"
rsync -az --delete -e "ssh -i ${KEY} -o IdentitiesOnly=yes" --rsync-path="sudo rsync" dist/ "${USER_AT}:${WEBROOT}/"

echo "==> Reloading nginx"
"${SSH[@]}" "flock /tmp/ktda-provision.lock sudo bash -c 'restorecon -R ${WEBROOT} && nginx -t && systemctl reload nginx'"

echo "==> Smoke check (from the box itself)"
page=$("${SSH[@]}" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:${PORT}${PREFIX}/")
inst=$("${SSH[@]}" "curl -s --max-time 10 http://127.0.0.1:${PORT}${PREFIX}/omni/api/operator/institutions")
echo "    GET ${PREFIX}/                               -> ${page} (want 200)"
echo "    GET ${PREFIX}/omni/api/operator/institutions -> ${inst}"
[[ "$page" == "200" ]] || { echo "!! page smoke check failed"; exit 1; }
grep -q "2d878f14-0d76-4aa0-b9d7-ffe4ace1562e" <<<"$inst" || { echo "!! omnichannel did not answer for KTDA"; exit 1; }
echo "==> Done. Public URL: https://ktda-apps-lb-1116460916.us-east-1.elb.amazonaws.com${PREFIX}/"
