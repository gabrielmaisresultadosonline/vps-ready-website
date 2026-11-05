// No Silva Drinks — servidor (Node.js + Express + PostgreSQL)
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3010);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 20) { console.error('Defina JWT_SECRET (20+ caracteres) no .env'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = (text, params) => pool.query(text, params);
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

// ---------- Uploads ----------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_, f, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, /^image\/(png|jpe?g|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(f.mimetype)),
});

// ---------- Helpers ----------
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro interno' }); });
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const num = (v) => Number(v || 0);
async function getSettings() {
  const r = await q('SELECT key,value FROM settings');
  return Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
}
function isOpen(s) {
  if (s.store_open === '1') return true;
  if (s.store_open === '0') return false;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: process.env.TZ_STORE || 'America/Sao_Paulo' }));
  const m = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = (s.open_time || '00:00').split(':').map(Number);
  const [ch, cm] = (s.close_time || '23:59').split(':').map(Number);
  const o = oh * 60 + om, c = ch * 60 + cm;
  return o <= c ? m >= o && m <= c : m >= o || m <= c;
}
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// ---------- Mapa: endereço -> coordenadas (OpenStreetMap / Nominatim, gratuito) ----------
let lastGeo = 0;
async function geocode(text) {
  const wait = Math.max(0, lastGeo + 1100 - Date.now()); lastGeo = Date.now() + wait; // máx. 1 por segundo
  if (wait) await new Promise((r) => setTimeout(r, wait));
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(text),
      { headers: { 'User-Agent': 'NoSilvaDrinks/1.0 (delivery)', 'Accept-Language': 'pt-BR' } });
    const j = await r.json();
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  } catch (e) { console.error('geocode', e.message); return null; }
}
async function geocodeOrder(id, street, number, neighborhood) {
  const s = await getSettings(), city = s.store_city || '';
  const g = (await geocode(`${street}, ${number}, ${neighborhood}, ${city}`)) || (await geocode(`${street}, ${neighborhood}, ${city}`)) || (await geocode(`${neighborhood}, ${city}`));
  if (g) await q('UPDATE orders SET lat=$1,lng=$2 WHERE id=$3', [g.lat, g.lng, id]);
}

// ---------- Auth ----------
function auth(req, res, next) {
  try { req.user = jwt.verify(req.cookies.nsd_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Não autenticado' }); }
}
const loginAttempts = new Map();
app.post('/api/auth/login', wrap(async (req, res) => {
  const ip = req.ip, a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 10) throw bad('Muitas tentativas. Aguarde 15 minutos.', 429);
  const { email, password } = req.body || {};
  const r = await q('SELECT * FROM admin_users WHERE email=$1 AND active', [String(email || '').toLowerCase().trim()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) { a.n++; loginAttempts.set(ip, a); throw bad('E-mail ou senha inválidos', 401); }
  loginAttempts.delete(ip);
  const token = jwt.sign({ id: u.id, name: u.name, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('nsd_token', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * 864e5, path: '/' });
  res.json({ name: u.name });
}));
app.post('/api/auth/logout', (req, res) => { res.clearCookie('nsd_token', { path: '/' }); res.json({ ok: true }); });
app.get('/api/auth/me', auth, (req, res) => res.json(req.user));
app.post('/api/auth/password', auth, wrap(async (req, res) => {
  const { current, next: nw } = req.body;
  if (!nw || nw.length < 8) throw bad('Nova senha precisa ter 8+ caracteres');
  const u = (await q('SELECT * FROM admin_users WHERE id=$1', [req.user.id])).rows[0];
  if (!(await bcrypt.compare(String(current || ''), u.password_hash))) throw bad('Senha atual incorreta');
  await q('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(nw, 10), u.id]);
  res.json({ ok: true });
}));

// ---------- Público ----------
app.get('/api/public/store', wrap(async (req, res) => {
  const s = await getSettings();
  const show = s.show_sold_out === '1';
  const [cats, prods, nbs] = await Promise.all([
    q('SELECT id,name,description,image FROM categories WHERE active ORDER BY sort_order,id'),
    q(`SELECT id,category_id,name,description,image,unit,sale_price,promo_price,stock_quantity,status,featured
       FROM products WHERE status<>'rascunho' ${show ? '' : "AND status='ativo' AND stock_quantity>0"} ORDER BY sort_order,name`),
    q('SELECT id,name,delivery_fee,estimated_minutes FROM neighborhoods WHERE active ORDER BY name'),
  ]);
  const pub = ['store_name', 'tagline', 'whatsapp', 'hero_title', 'hero_subtitle', 'hero_image', 'logo', 'favicon', 'open_time', 'close_time', 'min_order', 'free_delivery_above', 'payment_methods'];
  res.json({
    settings: Object.fromEntries(pub.map((k) => [k, s[k]])), open: isOpen(s), categories: cats.rows,
    products: prods.rows.map((p) => ({ ...p, available: p.status === 'ativo' && p.stock_quantity > 0 })),
    neighborhoods: nbs.rows,
  });
}));

app.post('/api/public/orders', wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 120), phone = onlyDigits(b.phone);
  if (name.length < 3) throw bad('Informe o nome completo');
  if (phone.length < 10 || phone.length > 13) throw bad('Telefone inválido');
  if (!b.street || !b.number) throw bad('Informe rua e número');
  if (!Array.isArray(b.items) || !b.items.length) throw bad('Carrinho vazio');
  const s = await getSettings();
  if (!isOpen(s)) throw bad('A loja está fechada no momento');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const nb = (await client.query('SELECT * FROM neighborhoods WHERE id=$1 AND active', [b.neighborhood_id])).rows[0];
    if (!nb) throw bad('Bairro indisponível para entrega');
    let subtotal = 0; const lines = [];
    for (const it of b.items) {
      const qty = Math.floor(num(it.quantity));
      if (qty < 1 || qty > 999) throw bad('Quantidade inválida');
      const p = (await client.query('SELECT * FROM products WHERE id=$1', [it.product_id])).rows[0];
      if (!p || p.status !== 'ativo') throw bad(`Produto indisponível: ${p ? p.name : it.product_id}`);
      if (qty > p.stock_quantity) throw bad(`Estoque insuficiente de ${p.name} (disponível: ${p.stock_quantity})`);
      const price = p.promo_price && num(p.promo_price) > 0 ? num(p.promo_price) : num(p.sale_price);
      subtotal += price * qty; lines.push({ p, qty, price });
    }
    if (num(s.min_order) > 0 && subtotal < num(s.min_order)) throw bad(`Pedido mínimo: R$ ${num(s.min_order).toFixed(2)}`);
    const fee = num(s.free_delivery_above) > 0 && subtotal >= num(s.free_delivery_above) ? 0 : num(nb.delivery_fee);
    const total = subtotal + fee;
    const addr = [b.street, b.number, b.complement].filter(Boolean).join(', ') + (b.reference ? ` (Ref: ${b.reference})` : '');
    const cust = (await client.query(
      `INSERT INTO customers (name,phone,neighborhood_id,street,number,complement,reference,first_order_at,last_order_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
       ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, neighborhood_id=EXCLUDED.neighborhood_id, street=EXCLUDED.street,
         number=EXCLUDED.number, complement=EXCLUDED.complement, reference=EXCLUDED.reference, last_order_at=now()
       RETURNING id`, [name, phone, nb.id, b.street, b.number, b.complement || null, b.reference || null])).rows[0];
    const changeFor = /dinheiro/i.test(b.payment_method || '') && num(b.change_for) > total ? num(b.change_for) : null;
    const o = (await client.query(
      `INSERT INTO orders (customer_id,customer_name,customer_phone,neighborhood_name,address,subtotal,delivery_fee,total,payment_method,notes,change_for)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,order_number`,
      [cust.id, name, phone, nb.name, addr, subtotal, fee, total, b.payment_method || null, String(b.notes || '').slice(0, 500) || null, changeFor])).rows[0];
    for (const l of lines) await client.query(
      'INSERT INTO order_items (order_id,product_id,product_name_snapshot,quantity,unit_price,unit_cost_snapshot) VALUES ($1,$2,$3,$4,$5,$6)',
      [o.id, l.p.id, l.p.name, l.qty, l.price, l.p.current_cost]);
    await client.query('COMMIT');
    geocodeOrder(o.id, b.street, b.number, nb.name).catch(() => {});
    const brl = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
    const fmtPhone = phone.length >= 10 ? `(${phone.slice(-11, -9) || phone.slice(0, 2)}) ${phone.slice(-9, -4)}-${phone.slice(-4)}` : phone;
    const msg = [
      `*NOVO PEDIDO — ${(s.store_name || 'NO SILVA DRINKS').toUpperCase()}*`, `Pedido: #${String(o.order_number).padStart(6, '0')}`, '',
      '*CLIENTE:*', `Nome: ${name}`, `WhatsApp: ${fmtPhone}`, '',
      '*ENDEREÇO:*', `Bairro: ${nb.name}`, `Rua: ${b.street}`, `Número: ${b.number}`,
      b.complement ? `Complemento: ${b.complement}` : null, b.reference ? `Referência: ${b.reference}` : null, '',
      '*PRODUTOS:*', ...lines.map((l) => `${l.qty}x ${l.p.name} — ${brl(l.price * l.qty)}`), '',
      `Subtotal: ${brl(subtotal)}`, `Entrega: ${fee ? brl(fee) : 'Grátis'}`, `*TOTAL: ${brl(total)}*`,
      b.payment_method ? `Pagamento: ${b.payment_method}` : null,
      changeFor ? `Troco para: ${brl(changeFor)} → levar troco de *${brl(changeFor - total)}*` : (/dinheiro/i.test(b.payment_method || '') ? 'Não precisa de troco' : null),
      b.notes ? `\nObservações: ${b.notes}` : null, '', 'Aguardamos confirmação!',
    ].filter((x) => x !== null).join('\n');
    res.json({ order_number: o.order_number, total, whatsapp_url: `https://wa.me/${onlyDigits(s.whatsapp)}?text=${encodeURIComponent(msg)}` });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));


// Cliente consulta o último pedido pelo telefone (mostra só número, status, itens e total)
const trackHits = new Map();
app.get('/api/public/track', wrap(async (req, res) => {
  const ip = req.ip, now = Date.now(), h = (trackHits.get(ip) || []).filter((t) => now - t < 60000);
  if (h.length >= 15) throw bad('Muitas consultas. Aguarde um minuto.', 429);
  h.push(now); trackHits.set(ip, h);
  const phone = onlyDigits(req.query.phone);
  if (phone.length < 10 || phone.length > 13) throw bad('Informe o telefone com DDD');
  const o = (await q(`SELECT o.id,o.order_number,o.status,o.total,o.created_at,o.out_for_delivery_at,o.delivered_at,
      COALESCE(json_agg(json_build_object('name',i.product_name_snapshot,'quantity',i.quantity)) FILTER (WHERE i.id IS NOT NULL),'[]') items
      FROM orders o LEFT JOIN order_items i ON i.order_id=o.id WHERE right(o.customer_phone,10)=right($1,10)
      GROUP BY o.id ORDER BY o.id DESC LIMIT 1`, [phone])).rows[0];
  if (!o) throw bad('Nenhum pedido encontrado para este telefone', 404);
  const s = await getSettings();
  delete o.id; res.json({ ...o, auto_deliver_minutes: num(s.auto_deliver_minutes) || 40 });
}));

// ---------- Admin: transações de estoque ----------
async function moveStock(client, { product_id, type, quantity, unit_cost, supplier, notes, order_id, user }) {
  const delta = ['entrada', 'estorno_venda'].includes(type) ? quantity : -quantity;
  const r = await client.query('UPDATE products SET stock_quantity=stock_quantity+$1, updated_at=now() WHERE id=$2 AND stock_quantity+$1>=0 RETURNING name,stock_quantity', [delta, product_id]);
  if (!r.rows[0]) throw bad('Estoque insuficiente para esta operação');
  return (await client.query(
    'INSERT INTO stock_movements (product_id,type,quantity,unit_cost,supplier,notes,order_id,user_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [product_id, type, delta, unit_cost ?? null, supplier || null, notes || null, order_id || null, user])).rows[0];
}
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

// ---------- Admin: CRUD genérico simples ----------
const A = express.Router();
A.use(auth);

A.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo inválido (imagem até 5MB)' });
  res.json({ url: 'uploads/' + req.file.filename });
});

// Configurações
A.get('/settings', wrap(async (req, res) => res.json(await getSettings())));
// Zerar dados (exige senha do admin)
A.post('/reset', wrap(async (req, res) => {
  const { password, what = [] } = req.body, w = new Set(what);
  const u = (await q('SELECT * FROM admin_users WHERE id=$1', [req.user.id])).rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) throw bad('Senha incorreta', 401);
  if (!w.size) throw bad('Escolha o que deseja zerar');
  if (w.has('produtos')) { w.add('estoque'); w.add('pedidos'); }
  await tx(async (c) => {
    if (w.has('financeiro')) await c.query('DELETE FROM finance_entries');
    if (w.has('pedidos')) await c.query('DELETE FROM finance_entries WHERE order_id IS NOT NULL');
    if (w.has('estoque')) { await c.query('DELETE FROM finance_entries WHERE stock_movement_id IS NOT NULL'); await c.query('DELETE FROM stock_movements'); await c.query('UPDATE products SET stock_quantity=0'); }
    if (w.has('pedidos')) { await c.query('UPDATE stock_movements SET order_id=NULL'); await c.query('DELETE FROM order_items'); await c.query('DELETE FROM orders'); await c.query('DELETE FROM customers'); await c.query('ALTER SEQUENCE orders_order_number_seq RESTART WITH 1'); }
    if (w.has('produtos')) await c.query('DELETE FROM products');
    await c.query('INSERT INTO audit_log(user_name,action,details) VALUES($1,$2,$3)', [req.user.name, 'zerar', [...w].join(',')]);
  });
  res.json({ ok: true });
}));
A.put('/settings', wrap(async (req, res) => {
  const before = await getSettings(), b = { ...(req.body || {}) };
  const addrChanged = (b.store_address !== undefined && b.store_address !== before.store_address) || (b.store_city !== undefined && b.store_city !== before.store_city);
  if (addrChanged && b.store_address) {
    const g = await geocode(`${b.store_address}, ${b.store_city ?? before.store_city ?? ''}`);
    b.store_lat = g ? g.lat : ''; b.store_lng = g ? g.lng : '';
  }
  for (const [k, v] of Object.entries(b)) await q('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [k, String(v ?? '')]);
  res.json(await getSettings());
}));

// Categorias
A.get('/categories', wrap(async (req, res) => res.json((await q('SELECT * FROM categories ORDER BY sort_order,id')).rows)));
A.post('/categories', wrap(async (req, res) => {
  const b = req.body; const r = await q('INSERT INTO categories(name,description,image,active,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING *', [b.name, b.description, b.image, b.active !== false, num(b.sort_order)]);
  res.json(r.rows[0]);
}));
A.put('/categories/:id', wrap(async (req, res) => {
  const b = req.body; const r = await q('UPDATE categories SET name=$1,description=$2,image=$3,active=$4,sort_order=$5 WHERE id=$6 RETURNING *', [b.name, b.description, b.image, b.active !== false, num(b.sort_order), req.params.id]);
  res.json(r.rows[0]);
}));

// Produtos
A.get('/products', wrap(async (req, res) => res.json((await q(`
  SELECT p.*, c.name AS category_name,
   COALESCE((SELECT SUM(quantity) FROM stock_movements WHERE product_id=p.id AND type='entrada'),0) AS total_bought,
   COALESCE((SELECT -SUM(quantity) FROM stock_movements WHERE product_id=p.id AND type IN ('venda','saida','estorno_venda','estorno')),0) AS total_out
  FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.sort_order,p.name`)).rows)));
A.post('/products', wrap(async (req, res) => {
  const b = req.body;
  const r = await q(`INSERT INTO products(category_id,name,description,image,unit,sale_price,promo_price,current_cost,stock_quantity,minimum_stock,status,featured,sort_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12) RETURNING *`,
    [b.category_id || null, b.name, b.description, b.image, b.unit || 'un', num(b.sale_price), b.promo_price ? num(b.promo_price) : null, num(b.current_cost), num(b.minimum_stock), b.status || 'ativo', !!b.featured, num(b.sort_order)]);
  if (num(b.stock_quantity) > 0) await tx((c) => moveStock(c, { product_id: r.rows[0].id, type: 'entrada', quantity: Math.floor(num(b.stock_quantity)), unit_cost: num(b.current_cost), notes: 'Estoque inicial', user: req.user.name }));
  res.json(r.rows[0]);
}));
A.put('/products/:id', wrap(async (req, res) => {
  const b = req.body;
  const r = await q(`UPDATE products SET category_id=$1,name=$2,description=$3,image=$4,unit=$5,sale_price=$6,promo_price=$7,current_cost=$8,minimum_stock=$9,status=$10,featured=$11,sort_order=$12,updated_at=now() WHERE id=$13 RETURNING *`,
    [b.category_id || null, b.name, b.description, b.image, b.unit || 'un', num(b.sale_price), b.promo_price ? num(b.promo_price) : null, num(b.current_cost), num(b.minimum_stock), b.status || 'ativo', !!b.featured, num(b.sort_order), req.params.id]);
  res.json(r.rows[0]);
}));
A.delete('/products/:id', wrap(async (req, res) => {
  await q("UPDATE products SET status='rascunho' WHERE id=$1", [req.params.id]); // nunca apaga: preserva histórico
  res.json({ ok: true });
}));

// Estoque
A.post('/stock/entry', wrap(async (req, res) => {
  const b = req.body, qty = Math.floor(num(b.quantity));
  if (qty < 1) throw bad('Quantidade inválida');
  const totalCost = num(b.total_cost), unit = qty ? totalCost / qty : 0;
  const m = await tx(async (c) => {
    const mv = await moveStock(c, { product_id: b.product_id, type: 'entrada', quantity: qty, unit_cost: unit, supplier: b.supplier, notes: b.notes, user: req.user.name });
    await c.query('UPDATE products SET current_cost=$1 WHERE id=$2', [unit, b.product_id]);
    if (totalCost > 0) await c.query(`INSERT INTO finance_entries(type,category,description,amount,payment_method,entry_date,stock_movement_id) VALUES('saida','Reposição de estoque',$1,$2,$3,$4,$5)`,
      [`Compra: ${qty} un${b.supplier ? ' — ' + b.supplier : ''}`, totalCost, b.payment_method || null, b.date || new Date().toISOString().slice(0, 10), mv.id]);
    return mv;
  });
  res.json(m);
}));
A.post('/stock/out', wrap(async (req, res) => {
  const qty = Math.floor(num(req.body.quantity));
  if (qty < 1) throw bad('Quantidade inválida');
  res.json(await tx((c) => moveStock(c, { product_id: req.body.product_id, type: 'saida', quantity: qty, notes: req.body.notes || 'Baixa rápida', user: req.user.name })));
}));
A.post('/stock/revert/:id', wrap(async (req, res) => {
  res.json(await tx(async (c) => {
    const m = (await c.query('SELECT * FROM stock_movements WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!m || m.reverted || m.type === 'estorno' || m.type === 'venda' || m.type === 'estorno_venda') throw bad('Movimentação não pode ser estornada');
    const r = await c.query('UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2 AND stock_quantity-$1>=0 RETURNING id', [m.quantity, m.product_id]);
    if (!r.rows[0]) throw bad('Estoque insuficiente para estornar');
    await c.query('UPDATE stock_movements SET reverted=true WHERE id=$1', [m.id]);
    await c.query('DELETE FROM finance_entries WHERE stock_movement_id=$1', [m.id]);
    return (await c.query("INSERT INTO stock_movements(product_id,type,quantity,notes,reverted_movement_id,user_name) VALUES($1,'estorno',$2,$3,$4,$5) RETURNING *",
      [m.product_id, -m.quantity, `Estorno da movimentação #${m.id}`, m.id, req.user.name])).rows[0];
  }));
}));
A.get('/stock/movements', wrap(async (req, res) => res.json((await q(`SELECT m.*, p.name AS product_name FROM stock_movements m JOIN products p ON p.id=m.product_id
  ${req.query.product_id ? 'WHERE m.product_id=$1' : ''} ORDER BY m.id DESC LIMIT 300`, req.query.product_id ? [req.query.product_id] : [])).rows)));

// Pedidos / vendas
A.get('/orders', wrap(async (req, res) => {
  const { status, from, to } = req.query, w = [], p = [];
  if (status) { p.push(status); w.push(`o.status=$${p.length}`); }
  if (from) { p.push(from); w.push(`o.created_at::date>=$${p.length}`); }
  if (to) { p.push(to); w.push(`o.created_at::date<=$${p.length}`); }
  const r = await q(`SELECT o.*, COALESCE(json_agg(json_build_object('name',i.product_name_snapshot,'quantity',i.quantity,'unit_price',i.unit_price,'unit_cost',i.unit_cost_snapshot)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items,
    COALESCE(SUM(i.quantity*i.unit_cost_snapshot),0) AS cost
    FROM orders o LEFT JOIN order_items i ON i.order_id=o.id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} GROUP BY o.id ORDER BY o.id DESC LIMIT 500`, p);
  res.json(r.rows);
}));
const CONFIRMED = ['confirmado', 'preparo', 'saiu', 'entregue'];
const STATUSES = ['aguardando', ...CONFIRMED, 'cancelado'];
async function setOrderStatus(c, id, status, user, payment_status) {
  if (!STATUSES.includes(status)) throw bad('Status inválido');
  const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!o) throw bad('Pedido não encontrado', 404);
  const items = (await c.query('SELECT * FROM order_items WHERE order_id=$1', [id])).rows;
  if (CONFIRMED.includes(status) && !o.stock_applied) {
    for (const it of items) if (it.product_id) await moveStock(c, { product_id: it.product_id, type: 'venda', quantity: it.quantity, unit_cost: it.unit_cost_snapshot, order_id: id, notes: `Pedido #${o.order_number}`, user });
    await c.query('UPDATE orders SET stock_applied=true WHERE id=$1', [id]);
    await c.query('UPDATE customers SET last_order_at=now() WHERE id=$1', [o.customer_id]);
  }
  if (status === 'cancelado' && o.stock_applied) {
    for (const it of items) if (it.product_id) await moveStock(c, { product_id: it.product_id, type: 'estorno_venda', quantity: it.quantity, order_id: id, notes: `Cancelamento pedido #${o.order_number}`, user });
    await c.query('UPDATE orders SET stock_applied=false WHERE id=$1', [id]);
    await c.query("DELETE FROM finance_entries WHERE order_id=$1", [id]);
    payment_status = 'cancelado';
  }
  const ps = payment_status || o.payment_status;
  if (ps === 'pago' && o.payment_status !== 'pago' && status !== 'cancelado') {
    await c.query(`INSERT INTO finance_entries(type,category,description,amount,payment_method,order_id) VALUES('entrada','Venda',$1,$2,$3,$4)`,
      [`Pedido #${o.order_number}`, o.total, o.payment_method, id]);
  }
  if (ps !== 'pago' && o.payment_status === 'pago') await c.query('DELETE FROM finance_entries WHERE order_id=$1', [id]);
  await c.query(`UPDATE orders SET status=$1,payment_status=$2,updated_at=now(),
    out_for_delivery_at=CASE WHEN $1='saiu' AND status<>'saiu' THEN now() WHEN $1 IN ('aguardando','confirmado','preparo') THEN NULL ELSE out_for_delivery_at END,
    delivered_at=CASE WHEN $1='entregue' AND status<>'entregue' THEN now() WHEN $1<>'entregue' THEN NULL ELSE delivered_at END
    WHERE id=$3`, [status, ps, id]);
  await c.query('INSERT INTO audit_log(user_name,action,details) VALUES($1,$2,$3)', [user, 'pedido_status', `#${o.order_number} -> ${status}/${ps}`]);
}
A.put('/orders/:id', wrap(async (req, res) => {
  await tx((c) => setOrderStatus(c, req.params.id, req.body.status, req.user.name, req.body.payment_status));
  res.json({ ok: true });
}));
// Excluir pedido: devolve o estoque e remove o lançamento financeiro antes de apagar
A.delete('/orders/:id', wrap(async (req, res) => {
  await tx(async (c) => {
    const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!o) throw bad('Pedido não encontrado', 404);
    if (o.stock_applied) await setOrderStatus(c, o.id, 'cancelado', req.user.name);
    await c.query('DELETE FROM finance_entries WHERE order_id=$1', [o.id]);
    await c.query('UPDATE stock_movements SET order_id=NULL WHERE order_id=$1', [o.id]);
    await c.query('DELETE FROM orders WHERE id=$1', [o.id]);
    await c.query('INSERT INTO audit_log(user_name,action,details) VALUES($1,$2,$3)', [req.user.name, 'pedido_excluido', `#${o.order_number}`]);
  });
  res.json({ ok: true });
}));
// Pedidos do dia para a tela ao vivo + mapa
A.get('/orders/live', wrap(async (req, res) => {
  const tz = process.env.TZ_STORE || 'America/Sao_Paulo';
  const [rows, s, last] = await Promise.all([
    q(`SELECT o.id,o.order_number,o.customer_name,o.customer_phone,o.neighborhood_name,o.address,o.total,o.payment_method,o.payment_status,o.status,o.source,o.notes,o.change_for,o.subtotal,o.delivery_fee,
        o.lat,o.lng,o.created_at,o.out_for_delivery_at,o.delivered_at,
        COALESCE(json_agg(json_build_object('name',i.product_name_snapshot,'quantity',i.quantity)) FILTER (WHERE i.id IS NOT NULL),'[]') items
       FROM orders o LEFT JOIN order_items i ON i.order_id=o.id
       WHERE (o.created_at AT TIME ZONE $1)::date=(now() AT TIME ZONE $1)::date OR o.status IN ('aguardando','confirmado','preparo','saiu')
       GROUP BY o.id ORDER BY o.id DESC`, [tz]),
    getSettings(),
    q(`SELECT COALESCE(MAX(id),0) id FROM orders WHERE source='site'`),
  ]);
  res.json({ orders: rows.rows, last_site_id: last.rows[0].id, auto_deliver_minutes: num(s.auto_deliver_minutes) || 40,
    store: { address: s.store_address, lat: s.store_lat ? Number(s.store_lat) : null, lng: s.store_lng ? Number(s.store_lng) : null } });
}));
A.get('/orders/last', wrap(async (req, res) => res.json((await q(`SELECT COALESCE(MAX(id),0) id FROM orders WHERE source='site'`)).rows[0])));
A.post('/orders/:id/locate', wrap(async (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (!isFinite(lat) || !isFinite(lng)) throw bad('Coordenadas inválidas');
  await q('UPDATE orders SET lat=$1,lng=$2 WHERE id=$3', [lat, lng, req.params.id]); res.json({ ok: true });
}));

A.post('/orders/manual', wrap(async (req, res) => {
  const b = req.body;
  if (!Array.isArray(b.items) || !b.items.length) throw bad('Adicione produtos');
  const r = await tx(async (c) => {
    let subtotal = 0; const lines = [];
    for (const it of b.items) {
      const p = (await c.query('SELECT * FROM products WHERE id=$1', [it.product_id])).rows[0];
      const qty = Math.floor(num(it.quantity)); if (!p || qty < 1) throw bad('Item inválido');
      const price = it.unit_price !== undefined && it.unit_price !== '' ? num(it.unit_price) : num(p.promo_price) || num(p.sale_price);
      subtotal += price * qty; lines.push({ p, qty, price });
    }
    const fee = num(b.delivery_fee);
    const o = (await c.query(`INSERT INTO orders(customer_name,customer_phone,subtotal,delivery_fee,total,payment_method,source,notes) VALUES($1,$2,$3,$4,$5,$6,'manual',$7) RETURNING *`,
      [b.customer_name || 'Venda balcão', onlyDigits(b.customer_phone) || null, subtotal, fee, subtotal + fee, b.payment_method || 'Dinheiro', b.notes || null])).rows[0];
    for (const l of lines) await c.query('INSERT INTO order_items(order_id,product_id,product_name_snapshot,quantity,unit_price,unit_cost_snapshot) VALUES($1,$2,$3,$4,$5,$6)', [o.id, l.p.id, l.p.name, l.qty, l.price, l.p.current_cost]);
    await setOrderStatus(c, o.id, 'entregue', req.user.name, b.paid === false ? 'pendente' : 'pago');
    return o;
  });
  res.json(r);
}));

// Bairros
A.get('/neighborhoods', wrap(async (req, res) => res.json((await q('SELECT * FROM neighborhoods ORDER BY name')).rows)));
A.post('/neighborhoods', wrap(async (req, res) => { const b = req.body; res.json((await q('INSERT INTO neighborhoods(name,delivery_fee,estimated_minutes,active,notes) VALUES($1,$2,$3,$4,$5) RETURNING *', [b.name, num(b.delivery_fee), b.estimated_minutes || null, b.active !== false, b.notes])).rows[0]); }));
A.put('/neighborhoods/:id', wrap(async (req, res) => { const b = req.body; res.json((await q('UPDATE neighborhoods SET name=$1,delivery_fee=$2,estimated_minutes=$3,active=$4,notes=$5 WHERE id=$6 RETURNING *', [b.name, num(b.delivery_fee), b.estimated_minutes || null, b.active !== false, b.notes, req.params.id])).rows[0]); }));
A.delete('/neighborhoods/:id', wrap(async (req, res) => { await q('UPDATE neighborhoods SET active=false WHERE id=$1', [req.params.id]); res.json({ ok: true }); }));

// Financeiro
A.get('/finance', wrap(async (req, res) => {
  const from = req.query.from || '1900-01-01', to = req.query.to || '2999-12-31';
  res.json((await q('SELECT * FROM finance_entries WHERE entry_date BETWEEN $1 AND $2 ORDER BY entry_date DESC,id DESC', [from, to])).rows);
}));
A.post('/finance', wrap(async (req, res) => {
  const b = req.body; if (!['entrada', 'saida'].includes(b.type) || num(b.amount) <= 0) throw bad('Dados inválidos');
  res.json((await q('INSERT INTO finance_entries(type,category,description,amount,payment_method,notes,entry_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [b.type, b.category || 'Outros', b.description, num(b.amount), b.payment_method, b.notes, b.entry_date || new Date().toISOString().slice(0, 10)])).rows[0]);
}));
A.delete('/finance/:id', wrap(async (req, res) => { await q('DELETE FROM finance_entries WHERE id=$1 AND order_id IS NULL AND stock_movement_id IS NULL', [req.params.id]); res.json({ ok: true }); }));

// Clientes
A.get('/customers', wrap(async (req, res) => res.json((await q(`SELECT c.*, n.name AS neighborhood,
  COUNT(o.id) FILTER (WHERE o.status<>'cancelado') AS orders_count, COALESCE(SUM(o.total) FILTER (WHERE o.status<>'cancelado'),0) AS total_spent
  FROM customers c LEFT JOIN neighborhoods n ON n.id=c.neighborhood_id LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id,n.name ORDER BY c.last_order_at DESC NULLS LAST`)).rows)));
A.get('/customers/:id/orders', wrap(async (req, res) => res.json((await q('SELECT order_number,total,status,created_at FROM orders WHERE customer_id=$1 ORDER BY id DESC', [req.params.id])).rows)));

// Dashboard / relatórios (CMV usa custo histórico do item vendido)
A.get('/dashboard', wrap(async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10), to = req.query.to || from;
  const conf = `o.stock_applied AND o.created_at::date BETWEEN $1 AND $2`;
  const [k, fin, pend, low, cust, daily, top, cats, monthly] = await Promise.all([
    q(`SELECT COUNT(DISTINCT o.id) sales, COALESCE(SUM(o.subtotal),0) products_rev, COALESCE(SUM(o.delivery_fee),0) delivery_rev, COALESCE(SUM(o.total),0) gross,
       COALESCE(SUM(o.total) FILTER (WHERE o.payment_status='pago'),0) received, COALESCE(SUM(o.total) FILTER (WHERE o.payment_status<>'pago'),0) pending_amount,
       COALESCE((SELECT SUM(i.quantity*i.unit_cost_snapshot) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${conf}),0) cmv,
       COALESCE((SELECT SUM(i.quantity) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${conf}),0) items_sold
       FROM orders o WHERE ${conf}`, [from, to]),
    q(`SELECT COALESCE(SUM(amount) FILTER (WHERE type='saida' AND category='Reposição de estoque'),0) investments,
       COALESCE(SUM(amount) FILTER (WHERE type='saida' AND category<>'Reposição de estoque'),0) expenses,
       COALESCE(SUM(amount) FILTER (WHERE type='entrada' AND order_id IS NULL),0) other_income,
       COALESCE(SUM(amount) FILTER (WHERE type='entrada'),0) cash_in, COALESCE(SUM(amount) FILTER (WHERE type='saida'),0) cash_out
       FROM finance_entries WHERE entry_date BETWEEN $1 AND $2`, [from, to]),
    q(`SELECT COUNT(*) FILTER (WHERE status='aguardando') pending, COUNT(*) FILTER (WHERE status='entregue' AND created_at::date BETWEEN $1 AND $2) done FROM orders`, [from, to]),
    q(`SELECT id,name,stock_quantity,minimum_stock FROM products WHERE status<>'rascunho' AND stock_quantity<=minimum_stock ORDER BY stock_quantity`),
    q('SELECT COUNT(*) n FROM customers'),
    q(`SELECT d::date AS day, COALESCE(SUM(o.total),0) total FROM generate_series($1::date,$2::date,'1 day') d LEFT JOIN orders o ON o.created_at::date=d::date AND o.stock_applied GROUP BY d ORDER BY d`, [from, to]),
    q(`SELECT i.product_name_snapshot name, SUM(i.quantity) qty, SUM(i.quantity*i.unit_price) total FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${conf} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [from, to]),
    q(`SELECT COALESCE(c.name,'Sem categoria') name, SUM(i.quantity*i.unit_price) total FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN products p ON p.id=i.product_id LEFT JOIN categories c ON c.id=p.category_id WHERE ${conf} GROUP BY 1 ORDER BY 2 DESC`, [from, to]),
    q(`SELECT to_char(m,'MM/YYYY') AS month,
       COALESCE((SELECT SUM(total) FROM orders WHERE stock_applied AND date_trunc('month',created_at)=m),0) revenue,
       COALESCE((SELECT SUM(i.quantity*(i.unit_price-i.unit_cost_snapshot)) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.stock_applied AND date_trunc('month',o.created_at)=m),0) gross_profit,
       COALESCE((SELECT SUM(amount) FROM finance_entries WHERE type='saida' AND category<>'Reposição de estoque' AND date_trunc('month',entry_date)=m),0) expenses
       FROM generate_series(date_trunc('month',now())-interval '11 months',date_trunc('month',now()),'1 month') m ORDER BY m`),
  ]);
  const K = k.rows[0], F = fin.rows[0];
  const grossProfit = num(K.products_rev) - num(K.cmv);
  res.json({
    ...K, ...F, ...pend.rows[0], customers: cust.rows[0].n, low_stock: low.rows,
    gross_profit: grossProfit, net_profit: grossProfit + num(K.delivery_rev) + num(F.other_income) - num(F.expenses),
    daily: daily.rows, top_products: top.rows, categories: cats.rows, monthly: monthly.rows,
  });
}));

app.use('/api/admin', A);

// ---------- Arquivos estáticos ----------
app.get('/admin', (req, res, next) => (req.originalUrl.split('?')[0].endsWith('/') ? next() : res.redirect('admin/')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: 'index.html', redirect: false }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Baixa automática: pedido "a caminho" vira "entregue" após X minutos (padrão 40)
async function autoDeliver() {
  try {
    const mins = num((await getSettings()).auto_deliver_minutes) || 40;
    const r = await q(`SELECT id FROM orders WHERE status='saiu' AND out_for_delivery_at < now() - ($1 || ' minutes')::interval`, [String(mins)]);
    for (const o of r.rows) await tx((c) => setOrderStatus(c, o.id, 'entregue', 'automático'));
  } catch (e) { console.error('autoDeliver', e.message); }
}
setInterval(autoDeliver, 60 * 1000);

app.listen(PORT, '127.0.0.1', () => console.log(`No Silva Drinks rodando em http://127.0.0.1:${PORT}`));
