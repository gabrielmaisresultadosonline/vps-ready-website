# No Silva Drinks — Instalação na VPS (junto com o MRO, sem afetar nada)

Estrutura criada:
```
/var/www/nosilva-drinks/
├── app/        código (loja + painel + servidor)
├── uploads/    fotos dos produtos
├── logs/       logs do app e do Nginx deste site
├── backups/    backups do banco nosilva_drinks
└── .env        senhas próprias (geradas na instalação)
```
Porta interna 3002 (só local) · banco `nosilva_drinks` · usuário `nosilva_app` · PM2 `nosilva-drinks`.

## 0. Cloudflare (zona nosilvadrinks.com.br)
A `@` → 2.24.104.47 e A `www` → 2.24.104.47, nuvem laranja. SSL/TLS → **Full (strict)**.

## 1. Baixar o código (terminal Hostinger, como root)
```bash
sudo mkdir -p /var/www/nosilva-drinks
cd /tmp && rm -rf nsd && git clone https://github.com/gabrielmaisresultadosonline/vps-ready-website.git nsd
sudo cp -r /tmp/nsd/vps /var/www/nosilva-drinks/app
```

## 2. Instalar
```bash
sudo bash /var/www/nosilva-drinks/app/install.sh
```

## 3. Domínio + SSL
```bash
sudo bash /var/www/nosilva-drinks/app/setup-dominio.sh
```
Abra https://nosilvadrinks.com.br e https://nosilvadrinks.com.br/admin
(login mro@gmail.com / guilherme2129 — troque em Configurações).

## 4. Conferir que o MRO segue normal
```bash
pm2 status            # mro-api, video-server e nosilva-drinks online
sudo nginx -t
```

## Atualizar no futuro
```bash
cd /tmp && rm -rf nsd && git clone https://github.com/gabrielmaisresultadosonline/vps-ready-website.git nsd
sudo rsync -a --delete --exclude node_modules --exclude .env /tmp/nsd/vps/ /var/www/nosilva-drinks/app/
cd /var/www/nosilva-drinks/app && sudo npm install --omit=dev && sudo npm run init-db && pm2 restart nosilva-drinks
```
Fotos e senhas ficam fora da pasta `app`, então não se perdem.

## Backup diário (guarda 14 dias)
```bash
echo '0 3 * * * postgres pg_dump nosilva_drinks | gzip > /var/www/nosilva-drinks/backups/$(date +\%F).sql.gz && find /var/www/nosilva-drinks/backups -name "*.sql.gz" -mtime +14 -delete' | sudo tee /etc/cron.d/nosilva-backup
sudo chown postgres /var/www/nosilva-drinks/backups
```

## Nunca use
`pm2 delete all`, `pm2 restart all`, `pm2 kill` — use sempre `pm2 restart nosilva-drinks`.

## Funcionamento
- Pedidos ao vivo com som e mapa; Em preparação → A caminho → Entregue sozinho em 40 min (ajustável). Cancelar/excluir devolve estoque.
- Cliente acompanha em "📦 Meu pedido" pelo telefone.
