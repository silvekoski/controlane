#!/usr/bin/env bash
# Runs on the Verda VM from /opt/app after each push to main (see .github/workflows/deploy.yml).
# Idempotent: installs what is missing, rebuilds both apps and restarts them.
# Caddy serves https://$DOMAIN on 80/443 in front of the starter (127.0.0.1:3000), and /slides redirects to the pitch deck at /deck;
# the control room stays on 127.0.0.1:3100 behind the starter.
set -euo pipefail
cd /opt/app
DOMAIN=${DOMAIN:-controlane.bobs.build}

if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get -o DPkg::Lock::Timeout=600 install -y nodejs
fi

unit() { # name, dir, command
  cat > /etc/systemd/system/$1.service <<EOF
[Service]
WorkingDirectory=/opt/app/$2
Environment=NODE_ENV=production
ExecStart=/usr/bin/env $3
Restart=always
[Install]
WantedBy=multi-user.target
EOF
}
unit control-room control-room "npx next start -H 127.0.0.1 -p 3100"
unit starter starter "npx next start -H 127.0.0.1 -p 3000"
systemctl daemon-reload

(cd starter && docker compose up -d --wait)
for app in control-room starter; do (cd $app && npm ci --no-audit --no-fund && npm run build); done

cd starter
npm run db:push -- --force
# ponytail: seeds once; delete /opt/app/.seeded to reseed (db:seed replaces the data)
if [ ! -f ../.seeded ]; then npm run db:seed && npm run attachments:seed && touch ../.seeded; fi

systemctl enable --now control-room starter
systemctl restart control-room starter

docker rm -f caddy >/dev/null 2>&1 || true
docker run -d --name caddy --restart always --network host -v caddy_data:/data \
  -v /opt/app/deploy/Caddyfile:/etc/caddy/Caddyfile:ro -e DOMAIN="$DOMAIN" caddy:2.10
