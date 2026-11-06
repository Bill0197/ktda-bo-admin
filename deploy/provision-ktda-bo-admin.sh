#!/usr/bin/env bash
# Idempotent provisioning for the KTDA Back Office on the UAT EC2 box
# (RHEL, SELinux Enforcing). Serves the built Vite SPA from /var/www/ktda-bo-admin
# under /admin/ on port 8185, and reverse-proxies the engine (8086) and
# omnichannel (8087) on localhost — see deploy/nginx/ktda-bo-admin.conf. The
# box-local port is reached only by the shared ALB (ktda-apps-lb). Safe to
# re-run on every deploy; it only changes what isn't already in place.
#
# Expects the site config at /tmp/ktda-bo-admin.conf (the deploy copies it there).
set -euo pipefail

PORT=8185
WEBROOT=/var/www/ktda-bo-admin
SITE_CONF_SRC=/tmp/ktda-bo-admin.conf
SITE_CONF_DST=/etc/nginx/conf.d/ktda-bo-admin.conf

# Serialize provisioning against the KTDA stub apps' deploys: semanage (the
# SELinux policy store) takes a global lock and racing calls fail. flock makes
# concurrent deploys take turns — the stub apps use the same lock file.
exec 9>/tmp/ktda-provision.lock
flock 9

echo "==> Ensuring nginx is installed"
rpm -q nginx >/dev/null 2>&1 || sudo dnf install -y nginx

echo "==> Installing site config ($SITE_CONF_DST)"
sudo install -m 0644 "$SITE_CONF_SRC" "$SITE_CONF_DST"

echo "==> Ensuring webroot exists ($WEBROOT)"
sudo mkdir -p "$WEBROOT"

echo "==> Labelling the webroot for nginx (SELinux)"
# /var/www is var_t on this image, not httpd_sys_content_t, so nginx would 403
# reading it. Add a persistent rule and relabel; files synced in later inherit it.
command -v semanage >/dev/null 2>&1 || sudo dnf install -y policycoreutils-python-utils
sudo semanage fcontext -a -t httpd_sys_content_t "${WEBROOT}(/.*)?" 2>/dev/null \
    || sudo semanage fcontext -m -t httpd_sys_content_t "${WEBROOT}(/.*)?"
sudo restorecon -R "$WEBROOT"

echo "==> Allowing nginx to listen on :$PORT (SELinux http_port_t)"
if command -v semanage >/dev/null 2>&1; then
    sudo semanage port -a -t http_port_t -p tcp "$PORT" 2>/dev/null \
        || sudo semanage port -m -t http_port_t -p tcp "$PORT" 2>/dev/null || true
fi

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

echo "==> Opening :$PORT if firewalld is running"
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-port="${PORT}/tcp"
    sudo firewall-cmd --reload
else
    echo "    firewalld inactive — nothing to open at the OS level"
fi

echo "==> Validating and enabling nginx"
sudo nginx -t
sudo systemctl enable --now nginx

echo "==> Provisioning complete: KTDA Back Office under /admin/ on :$PORT"
