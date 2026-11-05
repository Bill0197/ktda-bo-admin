#!/usr/bin/env bash
# Idempotent server provisioning for BO Admin on the UAT EC2 box
# (RHEL, SELinux Enforcing). Safe to re-run on every deploy: it only changes
# what isn't already in place.
#
# Expects the site config at /tmp/bo-admin.conf (the deploy copies it there).
#
# BO Admin replaces tokenization-web on this box. Both claim port 80 as the
# default server, so they cannot run side by side. If tokenization-web's site
# config is still installed, this stops — unless REPLACE_TOKENIZATION_WEB=1,
# in which case it is disabled (renamed, not deleted, so it can be restored).
set -euo pipefail

# Disabled for the KTDA back office: this ships to Investcent's UAT box and
# takes over its web root. Retarget it to a KTDA host before removing this.
echo "Disabled in the KTDA back office: this still targets Investcent's UAT box (see deploy/README.md)." >&2
exit 1

WEBROOT=/var/www/bo-admin
SITE_CONF_SRC=/tmp/bo-admin.conf
SITE_CONF_DST=/etc/nginx/conf.d/bo-admin.conf
OLD_CONF=/etc/nginx/conf.d/tokenization-web.conf

echo "==> Ensuring nginx is installed"
if ! rpm -q nginx >/dev/null 2>&1; then
    sudo dnf install -y nginx
else
    echo "    nginx already installed"
fi

echo "==> Checking for tokenization-web's site"
if [[ -f "$OLD_CONF" ]]; then
    if [[ "${REPLACE_TOKENIZATION_WEB:-0}" == "1" ]]; then
        sudo mv "$OLD_CONF" "$OLD_CONF.disabled"
        echo "    disabled $OLD_CONF (renamed to .disabled — restore it to roll back)"
    else
        echo "!!  $OLD_CONF is still installed and also serves port 80."
        echo "    Re-run with REPLACE_TOKENIZATION_WEB=1 to disable it and serve BO Admin instead."
        exit 1
    fi
fi

echo "==> Removing the stock default server (it also claims listen 80 default_server)"
# The packaged /etc/nginx/nginx.conf ships a `server {}` on port 80 that would
# collide with ours. Delete that block once (backup at nginx.conf.orig).
if grep -q 'server {' /etc/nginx/nginx.conf; then
    sudo cp -n /etc/nginx/nginx.conf /etc/nginx/nginx.conf.orig
    sudo awk '
        BEGIN { depth = 0; skipping = 0 }
        !skipping && /^[[:space:]]*server[[:space:]]*\{/ { skipping = 1; depth = 1; next }
        skipping {
            n = gsub(/\{/, "{"); depth += n
            m = gsub(/\}/, "}"); depth -= m
            if (depth <= 0) skipping = 0
            next
        }
        { print }
    ' /etc/nginx/nginx.conf | sudo tee /etc/nginx/nginx.conf.new >/dev/null
    sudo mv /etc/nginx/nginx.conf.new /etc/nginx/nginx.conf
fi

echo "==> Installing site config"
sudo install -m 0644 "$SITE_CONF_SRC" "$SITE_CONF_DST"

echo "==> Ensuring webroot exists ($WEBROOT)"
sudo mkdir -p "$WEBROOT"

echo "==> Labelling the webroot for nginx (SELinux)"
# /var/www is var_t on this image, not httpd_sys_content_t, so nginx would get
# a 403 reading it. Add a persistent rule for the webroot and relabel; files
# synced in later are then created with the right label.
if ! command -v semanage >/dev/null 2>&1; then
    sudo dnf install -y policycoreutils-python-utils
fi
# Add the rule, or modify it when an earlier run already added it. Not a
# "list | grep -q" guard: grep -q closes the pipe on the first match, semanage
# dies with a broken pipe, and under pipefail the guard then wrongly adds again
# ("File context ... already defined").
sudo semanage fcontext -a -t httpd_sys_content_t "${WEBROOT}(/.*)?" 2>/dev/null \
    || sudo semanage fcontext -m -t httpd_sys_content_t "${WEBROOT}(/.*)?"
sudo restorecon -R "$WEBROOT"

echo "==> Allowing nginx to make outbound connections (SELinux)"
# Without this the proxies to 127.0.0.1:8086 / :8087 fail with 502 and an AVC
# denial in the audit log.
if command -v getsebool >/dev/null 2>&1; then
    if [[ "$(getsebool httpd_can_network_connect | awk '{print $3}')" != "on" ]]; then
        sudo setsebool -P httpd_can_network_connect 1
    else
        echo "    httpd_can_network_connect already on"
    fi
fi

echo "==> Opening port 80 if firewalld is running"
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --reload
else
    echo "    firewalld inactive — nothing to open at the OS level"
fi

echo "==> Validating and enabling nginx"
sudo nginx -t
sudo systemctl enable --now nginx

echo "==> Provisioning complete"
