// Cria as tabelas e o usuário administrador. Uso: npm run init-db
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const email = (process.env.ADMIN_EMAIL || 'admin@nosilva.com').toLowerCase();
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || pass.length < 8) throw new Error('Defina ADMIN_PASSWORD (8+ caracteres) no .env');
  await pool.query(
    `INSERT INTO admin_users(name,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING`,
    ['Administrador', email, await bcrypt.hash(pass, 10)]
  );
  console.log('Banco pronto. Login do painel:', email);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
