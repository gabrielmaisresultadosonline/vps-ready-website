#!/usr/bin/env bash
# =====================================================================
#  No Silva Drinks — ATUALIZAÇÃO SEGURA (não apaga nenhum dado)
#
#  Uso normal (já estando DENTRO da pasta do site):
#     cd /var/www/nosilva-drinks/app
#     sudo bash update.sh
#
#  Também funciona de qualquer outra pasta:
#     sudo bash /var/www/nosilva-drinks/app/update.sh
#
#  O que ele faz:
#  1) Faz backup completo do banco ANTES de qualquer coisa
#  2) Faz backup dos arquivos do programa
#  3) Baixa o código novo do GitHub para uma pasta provisória (/tmp)
#  4) Troca só os arquivos do programa — banco, fotos e .env ficam intactos
#  5) Atualiza a estrutura do banco só ADICIONANDO (nunca apaga tabelas/dados)
#  6) Reinicia só o processo nosilva-drinks e mostra a contagem dos dados
#
#  NÃO toca em: mro-api, video-server, Nginx, SSL, PM2 de outros sites.
# =====================================================================
set -euo pipefail
BASE="/var/www/nosilva-drinks"; APP="$BASE/app"; ENV_FILE="$BASE/.env"
REPO="https://github.com/gabrielmaisresultadosonline/vps-ready-website.git"
HERE="$(cd "$(dirname "$0")" && pwd)"

# Proteção: nunca rodar este script dentro das pastas do outro site.
case "$HERE" in /var/www/ia-mro*|/var/www/video-server*|/var/www/uploads*)
  echo "!! Você está dentro de uma pasta do OUTRO site ($HERE). Nada foi alterado."; exit 1;;
esac

echo "==> Rodando da pasta: $HERE"
echo "==> Site que será atualizado: $APP"

[ -d "$APP" ] || { echo "!! $APP não existe. Use o instalador primeiro: sudo bash install.sh"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "!! $ENV_FILE não existe. Nada foi alterado."; exit 1; }
DB_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$DB_URL" ] || { echo "!! DATABASE_URL vazio no .env. Nada foi alterado."; exit 1; }

count() { psql "$DB_URL" -tAc "SELECT 'produtos='||(SELECT COUNT(*) FROM products)||'  pedidos='||(SELECT COUNT(*) FROM orders)||'  clientes='||(SELECT COUNT(*) FROM customers)||'  mov.estoque='||(SELECT COUNT(*) FROM stock_movements)" 2>/dev/null || echo "(não consegui contar)"; }

echo "==> Dados ANTES:  $(count)"
mkdir -p "$BASE/backups"
BK="$BASE/backups/antes-update-$(date +%F-%H%M%S).sql.gz"
pg_dump "$DB_URL" | gzip > "$BK"
[ -s "$BK" ] || { echo "!! Backup do banco falhou. Nada foi alterado."; exit 1; }
echo "==> Backup do banco salvo: $BK"

tar --exclude=node_modules -czf "$BASE/backups/arquivos-antes-update-$(date +%F-%H%M%S).tar.gz" -C "$BASE" app 2>/dev/null \
  && echo "==> Backup dos arquivos do programa salvo em $BASE/backups/" || true

# Baixa o código novo numa pasta provisória (fora da pasta do site).
cd /tmp && rm -rf nsd-up && git clone -q --depth 1 "$REPO" nsd-up
[ -d /tmp/nsd-up/vps ] || { echo "!! Não achei a pasta vps/ no GitHub. Nada foi alterado."; exit 1; }

# Troca só os arquivos do programa. Banco, fotos, logs, .env e dependências ficam.
rsync -a --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude uploads \
  --exclude logs \
  /tmp/nsd-up/vps/ "$APP/"
ln -sf "$ENV_FILE" "$APP/.env"

cd "$APP" && npm install --omit=dev --no-audit --no-fund && npm run init-db
pm2 restart nosilva-drinks --update-env
rm -rf /tmp/nsd-up

echo "==> Dados DEPOIS: $(count)"
echo "Se algo parecer errado, restaure com:"
echo "  gunzip -c $BK | psql \"\$(grep ^DATABASE_URL= $ENV_FILE | cut -d= -f2-)\""
echo "==> Pronto. Nada do outro site (MRO), do Nginx, do SSL ou do PM2 deles foi alterado."
