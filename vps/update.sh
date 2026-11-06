#!/usr/bin/env bash
# =====================================================================
#  No Silva Drinks — ATUALIZAÇÃO SEGURA (não apaga nenhum dado)
#  Uso:  sudo bash /var/www/nosilva-drinks/app/update.sh
#  1) Faz backup completo do banco ANTES de qualquer coisa
#  2) Troca só os arquivos do programa (banco, fotos e .env ficam intactos)
#  3) Atualiza a estrutura do banco só ADICIONANDO (nunca apaga tabelas/dados)
#  4) Reinicia só o processo nosilva-drinks e mostra a contagem dos dados
# =====================================================================
set -euo pipefail
BASE="/var/www/nosilva-drinks"; APP="$BASE/app"; ENV_FILE="$BASE/.env"
REPO="https://github.com/gabrielmaisresultadosonline/vps-ready-website.git"

[ -f "$ENV_FILE" ] || { echo "!! $ENV_FILE não existe. Nada foi alterado."; exit 1; }
DB_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$DB_URL" ] || { echo "!! DATABASE_URL vazio no .env. Nada foi alterado."; exit 1; }

count() { psql "$DB_URL" -tAc "SELECT 'produtos='||(SELECT COUNT(*) FROM products)||'  pedidos='||(SELECT COUNT(*) FROM orders)||'  clientes='||(SELECT COUNT(*) FROM customers)||'  mov.estoque='||(SELECT COUNT(*) FROM stock_movements)" 2>/dev/null || echo "(não consegui contar)"; }

echo "==> Dados ANTES:  $(count)"
mkdir -p "$BASE/backups"
BK="$BASE/backups/antes-update-$(date +%F-%H%M%S).sql.gz"
pg_dump "$DB_URL" | gzip > "$BK"
[ -s "$BK" ] || { echo "!! Backup falhou. Nada foi alterado."; exit 1; }
echo "==> Backup salvo: $BK"

cd /tmp && rm -rf nsd-up && git clone -q "$REPO" nsd-up
rsync -a --delete --exclude node_modules --exclude .env /tmp/nsd-up/vps/ "$APP/"
ln -sf "$ENV_FILE" "$APP/.env"
cd "$APP" && npm install --omit=dev --no-audit --no-fund && npm run init-db
pm2 restart nosilva-drinks --update-env

echo "==> Dados DEPOIS: $(count)"
echo "Se algo parecer errado, restaure com:"
echo "  gunzip -c $BK | psql \"\$(grep ^DATABASE_URL= $ENV_FILE | cut -d= -f2-)\""
