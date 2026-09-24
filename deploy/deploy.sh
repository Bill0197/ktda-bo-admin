#!/usr/bin/env bash
# Build BO Admin and ship it to one UAT EC2 box by hand — the same steps the
# "Deploy to EC2" GitHub workflow runs, for when you'd rather run them yourself.
#
# Usage (from the bo-admin folder):
#   deploy/deploy.sh <host> <ssh-key.pem> [--replace-tokenization-web]
#
# e.g. deploy/deploy.sh 3.226.168.177 ~/keys/uniapp1.pem --replace-tokenization-web
#
# --replace-tokenization-web is needed once, on a box that still serves
# tokenization-web: both claim port 80, so its site config is disabled
# (renamed, not deleted). See deploy/README.md.
set -euo pipefail

HOST="${1:?usage: deploy/deploy.sh <host> <ssh-key.pem> [--replace-tokenization-web]}"
KEY="${2:?usage: deploy/deploy.sh <host> <ssh-key.pem> [--replace-tokenization-web]}"
REPLACE=0
[[ "${3:-}" == "--replace-tokenization-web" ]] && REPLACE=1

USER_AT="ec2-user@${HOST}"
WEBROOT=/var/www/bo-admin
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes "$USER_AT")
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes)

cd "$(dirname "$0")/.."

echo "==> Building"
npm ci
npm run build

echo "==> Provisioning ${HOST}"
"${SCP[@]}" deploy/nginx/bo-admin.conf "${USER_AT}:/tmp/bo-admin.conf"
"${SCP[@]}" deploy/provision.sh        "${USER_AT}:/tmp/provision.sh"
"${SSH[@]}" "chmod +x /tmp/provision.sh && REPLACE_TOKENIZATION_WEB=${REPLACE} /tmp/provision.sh"

echo "==> Syncing the build to ${WEBROOT}"
rsync -az --delete -e "ssh -i ${KEY} -o IdentitiesOnly=yes" --rsync-path="sudo rsync" dist/ "${USER_AT}:${WEBROOT}/"

echo "==> Reloading nginx"
"${SSH[@]}" "sudo restorecon -R ${WEBROOT} && sudo nginx -t && sudo systemctl reload nginx"

echo "==> Smoke check (from the box itself)"
# The page, and a signed-out engine call: 200 then 401 means nginx serves the
# app and reaches the engine. A 502 means the engine isn't running on 8086.
page=$("${SSH[@]}" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/")
api=$("${SSH[@]}" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/tok/auth/me")
echo "    GET /             -> ${page} (want 200)"
echo "    GET /tok/auth/me  -> ${api} (want 401)"
[[ "$page" == "200" && "$api" == "401" ]] || { echo "!! smoke check failed"; exit 1; }
echo "==> Done"
