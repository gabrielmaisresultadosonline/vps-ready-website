#!/usr/bin/env bash
# Instalador do No Silva Drinks — NÃO altera outros sites, NGINX nem SSL existentes.
# Uso (dentro da pasta do projeto):  sudo bash install.sh
set -euo pipefail
cd "$(dirname "$0")"
APP_DIR="$(pwd)"
PORT="${PORT:-3010}"
DB_NAME="nosilva"; DB_USER="nosilva"

echo "==> Pasta do projeto: $APP_DIR"

# 1) Node.js 20 (só instala se não existir)
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  echo "==> Instalando Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 2) PostgreSQL (só instala se não existir)
if ! command -v psql >/dev/null; then
  echo "==> Instalando PostgreSQL"
  apt-get update && apt-get install -y postgresql postgresql-contrib
  systemctl enable --now postgresql
fi

# 3) Verifica porta livre
if ss -ltn | grep -q ":$PORT "; then
  echo "!! A porta $PORT já está em uso. Rode de novo com outra porta: sudo PORT=3020 bash install.sh"; exit 1
fi

# 4) .env + banco exclusivo deste site
if [ ! -f .env ]; then
  DB_PASS="$(openssl rand -hex 16)"
  JWT="$(openssl rand -hex 32)"
  ADMIN_PASS="guilherme2129"
  cat > .env <<EOF
PORT=$PORT
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
JWT_SECRET=$JWT
ADMIN_EMAIL=mro@gmail.com
ADMIN_PASSWORD=$ADMIN_PASS
TZ_STORE=America/Sao_Paulo
EOF
  chmod 600 .env
  echo "==> Criando banco '$DB_NAME' (separado dos outros bancos)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$DB_USER') THEN CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS'; END IF; END \$\$;
EOF
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
else
  echo "==> .env já existe, mantendo configurações"
  ADMIN_PASS="(a que está no arquivo .env)"
fi

# 5) Dependências e tabelas
npm install --omit=dev
npm run init-db

# 6) PM2 (mantém o site rodando e reinicia com a VPS)
command -v pm2 >/dev/null || npm install -g pm2
pm2 start ecosystem.config.js --update-env || pm2 restart nosilva-drinks --update-env
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true

echo
echo "================ PRONTO ================"
echo "Site rodando internamente em: http://127.0.0.1:$PORT"
echo "Login do painel: mro@gmail.com"
echo "Senha inicial:   $ADMIN_PASS   (troque em Configurações)"
echo
echo "Falta só ligar um endereço ao site. Veja o LEIA-ME.md, passo 3"
echo "(nginx-dominio.conf + Cloudflare)."
echo "========================================"
