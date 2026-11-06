// Cria as tabelas e o usuário administrador. Uso: npm run init-db
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const email = (process.env.ADMIN_EMAIL || 'mro@gmail.com').toLowerCase();
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || pass.length < 8) throw new Error('Defina ADMIN_PASSWORD (8+ caracteres) no .env');
  await pool.query(
    `INSERT INTO admin_users(name,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING`,
    ['Administrador', email, await bcrypt.hash(pass, 10)]
  );
  // Produtos de exemplo: só na primeira vez (se você excluir, não voltam)
  const flag = await pool.query("SELECT 1 FROM settings WHERE key='demo_seeded'");
  if (!flag.rowCount) {
    const has = await pool.query('SELECT COUNT(*)::int n FROM products');
    if (has.rows[0].n === 0) {
      for (const [i, [cat, name, unit, sale, promo, cost, qty, feat, img]] of require('./demo-products').entries())
        await pool.query(`INSERT INTO products(category_id,name,unit,sale_price,promo_price,current_cost,stock_quantity,featured,image,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [cat, name, unit, sale, promo, cost, qty, feat, 'img/produtos/' + img + '.jpg', i]);
      console.log('20 produtos de exemplo criados.');
    }
    await pool.query("INSERT INTO settings(key,value) VALUES('demo_seeded','1') ON CONFLICT(key) DO NOTHING");
  }
  console.log('Banco pronto. Login do painel:', email);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
