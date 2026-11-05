# No Silva Drinks — Instalação na VPS (Ubuntu)

Loja online + painel administrativo (/admin) com PostgreSQL.
Fica numa pasta própria, usa um banco próprio e uma porta interna própria (3010).
**Não mexe no outro site, no NGINX dele nem no SSL existente.**

---

## Passo 1 — Enviar a pasta para a VPS

No seu computador (troque `usuario@IP`):

```bash
scp nosilva-drinks.zip usuario@IP:/tmp/
# ou direto do GitHub, na VPS:
# git clone https://github.com/gabrielmaisresultadosonline/vps-ready-website.git /tmp/nsd && sudo cp -r /tmp/nsd/vps /var/www/nosilva-drinks
```

Na VPS:

```bash
sudo apt-get install -y unzip
sudo mkdir -p /var/www/nosilva-drinks
sudo unzip /tmp/nosilva-drinks.zip -d /var/www/nosilva-drinks
cd /var/www/nosilva-drinks
```

## Passo 2 — Rodar o instalador

```bash
sudo bash install.sh
```

Ele faz sozinho: instala Node.js e PostgreSQL **só se ainda não existirem**, cria o banco `nosilva`
(separado dos outros), gera senhas seguras no arquivo `.env`, cria as tabelas e deixa o site
rodando com PM2 (volta sozinho se a VPS reiniciar).

No final ele mostra **o e-mail e a senha inicial do painel**. Anote.

> Se a porta 3010 já estiver ocupada: `sudo PORT=3020 bash install.sh`
> (e use 3020 no arquivo nginx-dominio.conf).

## Passo 3 — Ligar o domínio próprio (Cloudflare)

O outro site continua com o domínio e o SSL dele. Este usa um domínio diferente e um
certificado só dele, em pasta separada (`/etc/ssl/nosilva/`).

**No Cloudflare (domínio da No Silva):**
1. **DNS** → adicione registro **A** `@` → IP da VPS (nuvem laranja ligada) e **A** `www` → mesmo IP.
2. **SSL/TLS → Visão geral** → modo **Full (strict)**. (É por domínio: não afeta o outro site.)
3. **SSL/TLS → Servidor de origem → Criar certificado** → deixe `nosilvadrinks.com.br` e
   `*.nosilvadrinks.com.br`, validade 15 anos → Criar. Copie os dois textos.

**Na VPS:**
```bash
sudo mkdir -p /etc/ssl/nosilva
sudo nano /etc/ssl/nosilva/origin.pem   # cole o "Certificado de origem"
sudo nano /etc/ssl/nosilva/origin.key   # cole a "Chave privada"
sudo chmod 600 /etc/ssl/nosilva/origin.key

sudo cp nginx-dominio.conf /etc/nginx/sites-available/nosilva
sudo nano /etc/nginx/sites-available/nosilva   # troque nosilvadrinks.com.br pelo seu domínio
sudo ln -s /etc/nginx/sites-available/nosilva /etc/nginx/sites-enabled/nosilva
sudo nginx -t && sudo systemctl reload nginx
```
Se `nginx -t` reclamar de `http2 on;`, apague essa linha e troque `listen 443 ssl;` por `listen 443 ssl http2;`.

Pronto: `https://seudominio.com.br` abre a loja e `https://seudominio.com.br/admin` o painel.

## Passo 4 — Primeiro acesso

1. Entre em `.../admin` com o e-mail e senha do Passo 2.
2. **Configurações**: número do WhatsApp que recebe os pedidos, horários, logo, banner. Troque a senha.
3. **Bairros e taxas**: cadastre os bairros atendidos.
4. **Produtos**: cadastre os produtos (foto por arquivo, Ctrl+V ou URL).
5. **Estoque → + Entrada**: registre as compras de mercadoria.

---

## Comandos úteis

| O quê | Comando |
|---|---|
| Ver se está rodando | `pm2 status` |
| Ver erros | `pm2 logs nosilva-drinks` |
| Reiniciar | `pm2 restart nosilva-drinks` |
| Backup do banco | `sudo -u postgres pg_dump nosilva > backup-$(date +%F).sql` |
| Restaurar backup | `sudo -u postgres psql nosilva < backup.sql` |

**Backup automático diário** (guarda 14 dias):
```bash
sudo mkdir -p /var/backups/nosilva
echo '0 3 * * * postgres pg_dump nosilva | gzip > /var/backups/nosilva/$(date +\%F).sql.gz && find /var/backups/nosilva -mtime +14 -delete' | sudo tee /etc/cron.d/nosilva-backup
```

## Atualizar o sistema no futuro
Substitua os arquivos (mantendo `.env` e `public/uploads/`) e rode:
```bash
npm install --omit=dev && npm run init-db && pm2 restart nosilva-drinks
```

## Estrutura
```
src/server.js        servidor e API
db/schema.sql        tabelas do banco
scripts/init-db.js   cria tabelas e o admin
public/              loja (index.html, store.js, style.css)
public/admin/        painel administrativo
public/uploads/      imagens enviadas pelo painel
```

## Como os números do financeiro são calculados
- **Faturamento bruto** = produtos + taxas de entrega dos pedidos confirmados.
- **CMV** = custo de cada produto *no momento da venda* (vendas antigas não mudam se o custo mudar).
- **Lucro bruto** = receita de produtos − CMV.
- **Resultado líquido** = lucro bruto + entregas + outras receitas − despesas operacionais.
- Compras de estoque saem do caixa, mas **não** são descontadas de novo do lucro.
- Pedidos do site entram como "Aguardando confirmação" e só baixam o estoque ao confirmar
  (uma única vez). Cancelar um pedido confirmado devolve o estoque.
