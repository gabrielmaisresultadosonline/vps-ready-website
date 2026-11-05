#!/usr/bin/env bash
# =====================================================================
#  No Silva Drinks — instalador ADITIVO (não mexe no MRO)
#  Uso:  sudo bash /var/www/nosilva-drinks/app/install.sh
#  - Não instala outro PostgreSQL, Docker nem Redis
#  - Não altera Nginx/SSL/portas/PM2 de outros sites
#  - Banco próprio: nosilva_drinks / usuário nosilva_app
#  - Porta interna: 3002 (só 127.0.0.1)
# =====================================================================
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="/var/www/nosilva-drinks"
PORT="${PORT:-3002}"
DB_NAME="nosilva_drinks"; DB_USER="nosilva_app"
ENV_FILE="$BASE/.env"

echo "==> Pasta do app: $APP_DIR"
case "$APP_DIR" in /var/www/ia-mro*|/var/www/video-server*|/var/www/uploads*) echo "!! Pasta do MRO. Abortando."; exit 1;; esac

# 1) Verificações (somente leitura)
echo "==> Recursos:"; free -h | head -2; df -h / | tail -1
command -v node >/dev/null || { echo "!! Node.js não encontrado (o MRO já usa Node, verifique)."; exit 1; }
[ "$(node -v | cut -d. -f1 | tr -d v)" -ge 18 ] || { echo "!! Node 18+ necessário."; exit 1; }
command -v psql >/dev/null || { echo "!! PostgreSQL não encontrado. Não vou instalar outro."; exit 1; }
command -v pm2  >/dev/null || { echo "!! PM2 não encontrado."; exit 1; }
if [ ! -f "$ENV_FILE" ] && ss -ltn | grep -q ":$PORT "; then
  echo "!! Porta $PORT ocupada. Use outra: sudo PORT=3003 bash install.sh"; exit 1
fi

# 2) Pastas próprias
mkdir -p "$BASE/uploads" "$BASE/logs" "$BASE/backups"
chmod 755 "$BASE/uploads"

# 3) .env + banco exclusivo (só na primeira vez)
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$PORT
DOMAIN=https://nosilvadrinks.com.br
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
JWT_SECRET=$(openssl rand -hex 48)
ADMIN_EMAIL=mro@gmail.com
ADMIN_PASSWORD=guilherme2129
UPLOAD_DIR=$BASE/uploads
TZ_STORE=America/Sao_Paulo
EOF
  chmod 600 "$ENV_FILE"
  echo "==> Criando usuário '$DB_USER' e banco '$DB_NAME' (o banco mro NÃO é tocado)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS'; END IF;
END \$\$;
EOF
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "REVOKE CONNECT ON DATABASE $DB_NAME FROM PUBLIC;" -c "GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;"
else
  echo "==> $ENV_FILE já existe, mantendo"
fi
ln -sf "$ENV_FILE" "$APP_DIR/.env"

# 4) Dependências SÓ dentro do projeto + tabelas no banco novo
cd "$APP_DIR"
npm install --omit=dev --no-audit --no-fund
npm run init-db

# 5) PM2 — somente o processo nosilva-drinks
if pm2 describe nosilva-drinks >/dev/null 2>&1; then
  pm2 restart nosilva-drinks --update-env
else
  pm2 start ecosystem.config.js --only nosilva-drinks
fi
pm2 save

sleep 2
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo " <- app OK" || echo "!! App não respondeu. Veja: pm2 logs nosilva-drinks"

echo
echo "================ PRONTO ================"
echo "App interno: http://127.0.0.1:$PORT  (não exposto à internet)"
echo "Painel: mro@gmail.com / guilherme2129 (troque em Configurações)"
echo "Próximo passo: sudo bash $APP_DIR/setup-dominio.sh"
echo "========================================"
