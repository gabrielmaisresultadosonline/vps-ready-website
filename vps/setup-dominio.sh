#!/usr/bin/env bash
# Cria SÓ o arquivo Nginx do nosilvadrinks.com.br e o certificado SSL dele (Certbot).
# Não edita nenhum outro arquivo do Nginx nem outros certificados.
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DOM="${DOM:-nosilvadrinks.com.br}"
EMAIL="${EMAIL:-mro@gmail.com}"
PORT="$(grep -E '^PORT=' /var/www/nosilva-drinks/.env | cut -d= -f2)"; PORT="${PORT:-3002}"
CONF="/etc/nginx/sites-available/$DOM"
WEBROOT="/var/www/nosilva-drinks/certbot"

if grep -rqs "server_name.*$DOM" /etc/nginx/sites-enabled/ --exclude="$DOM"; then
  echo "!! Outro arquivo do Nginx já usa $DOM. Verifique antes:"; grep -rl "$DOM" /etc/nginx/sites-enabled/; exit 1
fi
mkdir -p "$WEBROOT"

# Etapa 1: HTTP temporário para validar o certificado
cat > "$CONF" <<EOF
server {
    listen 80; listen [::]:80;
    server_name $DOM www.$DOM;
    location /.well-known/acme-challenge/ { root $WEBROOT; }
    location / { proxy_pass http://127.0.0.1:$PORT; proxy_set_header Host \$host; }
}
EOF
ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOM"
nginx -t && systemctl reload nginx

# Certificado só deste domínio (não toca nos outros)
certbot certonly --webroot -w "$WEBROOT" -d "$DOM" -d "www.$DOM" \
  --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring

# Etapa 2: configuração final HTTPS
sed -e "s/nosilvadrinks.com.br/$DOM/g" -e "s/127.0.0.1:3002/127.0.0.1:$PORT/g" "$APP_DIR/nginx-dominio.conf" > "$CONF"
if ! nginx -t 2>/dev/null; then
  sed -i -e '/http2 on;/d' -e 's/listen 443 ssl;/listen 443 ssl http2;/' -e 's/listen \[::\]:443 ssl;/listen [::]:443 ssl http2;/' "$CONF"
fi
nginx -t && systemctl reload nginx
echo "==> Pronto: https://$DOM e https://www.$DOM"
echo "No Cloudflare deste domínio: SSL/TLS -> modo Full (strict)."
