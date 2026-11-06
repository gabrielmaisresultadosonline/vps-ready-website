// Adiciona os 20 produtos de exemplo agora (mesmo que já exista algo). Uso: npm run demo-products
require('dotenv').config();
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let n = 0;
  for (const [i, [cat, name, unit, sale, promo, cost, qty, feat, img]] of require('./demo-products').entries()) {
    const r = await pool.query(`INSERT INTO products(category_id,name,unit,sale_price,promo_price,current_cost,stock_quantity,featured,image,sort_order)
      SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name=$2)`, [cat, name, unit, sale, promo, cost, qty, feat, 'img/produtos/' + img + '.jpg', i]);
    n += r.rowCount;
  }
  console.log(n + ' produtos de exemplo adicionados.');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
