// Somente para a pré-visualização no Lovable: simula o servidor inteiro no navegador (dados salvos no localStorage).
// Loja e painel compartilham os mesmos dados. Este arquivo NÃO vai para a VPS (lá tudo vem do banco PostgreSQL).
(function () {
  var KEY = 'nsd_demo_db_v1';
  var LOGIN = { email: 'mro@gmail.com', password: 'guilherme2129', name: 'Administrador' };
  var now = function () { return new Date().toISOString(); };
  var today = function () { var d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
  var digits = function (s) { return String(s || '').replace(/\D/g, ''); };
  var P = function (id, c, name, unit, price, promo, cost, stock, featured) {
    return { id: id, category_id: c, name: name, description: '', image: '', unit: unit, sale_price: price, promo_price: promo, current_cost: cost, stock_quantity: stock, minimum_stock: 5, status: 'ativo', featured: !!featured, sort_order: 0 };
  };
  function seed() {
    return {
      seq: { cat: 3, prod: 20, nb: 3, cust: 0, order: 0, num: 0, mv: 0, fin: 0 },
      settings: {
        store_name: 'No Silva Drinks', tagline: 'Você da Campina, São Leopoldo', whatsapp: '5551999999999',
        hero_title: 'SUA BEBIDA FAVORITA CHEGA ATÉ VOCÊ!', hero_subtitle: 'Escolha, peça e receba sem sair de casa.',
        hero_image: '', logo: '', favicon: '', open_time: '00:00', close_time: '23:59', store_open: '1',
        min_order: '0', free_delivery_above: '0', payment_methods: 'Pix,Dinheiro,Cartão', show_sold_out: '1',
        store_address: 'Av. Mauá, 1000', store_city: 'São Leopoldo, RS', store_lat: '-29.7604', store_lng: '-51.1472', auto_deliver_minutes: '40',
      },
      categories: [{ id: 1, name: 'ALCOÓLICOS', active: true, sort_order: 0 }, { id: 2, name: 'NÃO ALCOÓLICOS', active: true, sort_order: 1 }, { id: 3, name: 'ITENS VARIADOS', active: true, sort_order: 2 }],
      products: [
        Object.assign(P(1, 1, "Cerveja Heineken Long Neck 330ml", 'un', 8.9, 7.5, 5, 48, true), { image: 'img/produtos/01.jpg' }),
        Object.assign(P(2, 1, "Cerveja Lata 350ml", 'un', 4.5, null, 2.8, 120, false), { image: 'img/produtos/02.jpg' }),
        Object.assign(P(3, 1, "Vodka 998ml", 'un', 49.9, 44.9, 30, 12, true), { image: 'img/produtos/03.jpg' }),
        Object.assign(P(4, 1, "Whisky 12 anos 700ml", 'un', 129.9, null, 90, 6, false), { image: 'img/produtos/04.jpg' }),
        Object.assign(P(5, 1, "Gin London Dry 700ml", 'un', 99.9, null, 65, 8, false), { image: 'img/produtos/05.jpg' }),
        Object.assign(P(6, 2, "Energético 250ml", 'un', 11.9, null, 7, 40, true), { image: 'img/produtos/06.jpg' }),
        Object.assign(P(7, 2, "Refrigerante Cola 2L", 'un', 12.9, null, 8, 30, false), { image: 'img/produtos/07.jpg' }),
        Object.assign(P(8, 2, "Água Mineral 500ml", 'un', 3.5, null, 1.2, 60, false), { image: 'img/produtos/08.jpg' }),
        Object.assign(P(9, 3, "Gelo 5kg", 'pct', 15, null, 7, 25, false), { image: 'img/produtos/09.jpg' }),
        Object.assign(P(10, 3, "Carvão 5kg", 'pct', 24, null, 12, 10, false), { image: 'img/produtos/10.jpg' }),
        Object.assign(P(11, 1, "Caipirinha de Limão", 'un', 18, 15.9, 6, 50, true), { image: 'img/produtos/11.jpg' }),
        Object.assign(P(12, 1, "Cachaça 700ml", 'un', 29.9, null, 16, 15, false), { image: 'img/produtos/12.jpg' }),
        Object.assign(P(13, 1, "Vinho Tinto 750ml", 'un', 59.9, null, 35, 10, false), { image: 'img/produtos/13.jpg' }),
        Object.assign(P(14, 1, "Espumante 750ml", 'un', 69.9, 59.9, 40, 8, false), { image: 'img/produtos/14.jpg' }),
        Object.assign(P(15, 1, "Rum Branco 700ml", 'un', 54.9, null, 32, 9, false), { image: 'img/produtos/15.jpg' }),
        Object.assign(P(16, 2, "Guaraná Lata 350ml", 'un', 5.5, null, 3, 80, false), { image: 'img/produtos/16.jpg' }),
        Object.assign(P(17, 2, "Suco de Laranja 1L", 'un', 14.9, null, 8, 20, false), { image: 'img/produtos/17.jpg' }),
        Object.assign(P(18, 1, "Pack 6 Cervejas Lata", 'pct', 29.9, 26.9, 18, 20, true), { image: 'img/produtos/18.jpg' }),
        Object.assign(P(19, 3, "Batata Chips 120g", 'un', 9.9, null, 5, 35, false), { image: 'img/produtos/19.jpg' }),
        Object.assign(P(20, 3, "Copos Descartáveis (10 un)", 'pct', 7.9, null, 3, 40, false), { image: 'img/produtos/20.jpg' }),
      ],
      neighborhoods: [
        { id: 1, name: 'Campina', delivery_fee: 5, estimated_minutes: 30, active: true, lat: -29.735, lng: -51.15 },
        { id: 2, name: 'Centro', delivery_fee: 8, estimated_minutes: 40, active: true, lat: -29.7604, lng: -51.1472 },
        { id: 3, name: 'Scharlau', delivery_fee: 7, estimated_minutes: 35, active: true, lat: -29.725, lng: -51.135 },
      ],
      customers: [], orders: [], movements: [], finance: [], logged: false,
    };
  }
  var db;
  function load() { try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { db = seed(); } }
  function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
  function err(m, s) { var e = new Error(m); e.status = s || 400; throw e; }
  var byId = function (arr, id) { return arr.find(function (x) { return String(x.id) === String(id); }); };
  var price = function (p) { return num(p.promo_price) > 0 ? num(p.promo_price) : num(p.sale_price); };
  var dateOf = function (iso) { var d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

  function moveStock(o) {
    var p = byId(db.products, o.product_id); if (!p) err('Produto não encontrado');
    var delta = ['entrada', 'estorno_venda'].indexOf(o.type) >= 0 ? o.quantity : -o.quantity;
    if (p.stock_quantity + delta < 0) err('Estoque insuficiente para esta operação');
    p.stock_quantity += delta;
    var m = { id: ++db.seq.mv, product_id: p.id, product_name: p.name, type: o.type, quantity: delta, unit_cost: o.unit_cost == null ? null : o.unit_cost, supplier: o.supplier || null, notes: o.notes || null, order_id: o.order_id || null, user_name: LOGIN.name, reverted: false, created_at: now() };
    db.movements.unshift(m); return m;
  }
  function addFin(f) { var e = Object.assign({ id: ++db.seq.fin, entry_date: today(), created_at: now() }, f); db.finance.unshift(e); return e; }
  var CONFIRMED = ['confirmado', 'preparo', 'saiu', 'entregue'];
  function setStatus(id, status, ps) {
    var o = byId(db.orders, id); if (!o) err('Pedido não encontrado', 404);
    if (CONFIRMED.indexOf(status) >= 0 && !o.stock_applied) {
      o.items.forEach(function (it) { if (it.product_id) moveStock({ product_id: it.product_id, type: 'venda', quantity: it.quantity, unit_cost: it.unit_cost, order_id: o.id, notes: 'Pedido #' + o.order_number }); });
      o.stock_applied = true;
    }
    if (status === 'cancelado' && o.stock_applied) {
      o.items.forEach(function (it) { if (it.product_id) moveStock({ product_id: it.product_id, type: 'estorno_venda', quantity: it.quantity, order_id: o.id, notes: 'Cancelamento pedido #' + o.order_number }); });
      o.stock_applied = false; db.finance = db.finance.filter(function (f) { return f.order_id !== o.id; }); ps = 'cancelado';
    }
    ps = ps || o.payment_status;
    if (ps === 'pago' && o.payment_status !== 'pago' && status !== 'cancelado') addFin({ type: 'entrada', category: 'Venda', description: 'Pedido #' + o.order_number, amount: o.total, payment_method: o.payment_method, order_id: o.id });
    if (ps !== 'pago' && o.payment_status === 'pago') db.finance = db.finance.filter(function (f) { return f.order_id !== o.id; });
    if (status === 'saiu' && o.status !== 'saiu') o.out_for_delivery_at = now();
    if (['aguardando', 'confirmado', 'preparo'].indexOf(status) >= 0) o.out_for_delivery_at = null;
    if (status === 'entregue' && o.status !== 'entregue') o.delivered_at = now();
    if (status !== 'entregue') o.delivered_at = null;
    o.status = status; o.payment_status = ps;
  }
  function autoDeliver() {
    var mins = num(db.settings.auto_deliver_minutes) || 40;
    db.orders.forEach(function (o) { if (o.status === 'saiu' && o.out_for_delivery_at && Date.now() - new Date(o.out_for_delivery_at) >= mins * 6e4) setStatus(o.id, 'entregue'); });
  }
  function isOpen() { var s = db.settings; if (s.store_open === '1') return true; if (s.store_open === '0') return false; var t = new Date().toTimeString().slice(0, 5); return t >= s.open_time && t <= s.close_time; }
  function inRange(d, q) { var f = q.get('from') || '1900-01-01', t = q.get('to') || '2999-12-31'; return d >= f && d <= t; }

  function handle(method, path, q, body) {
    load(); autoDeliver();
    var s = db.settings, m, r;
    // ---------- auth ----------
    if (path === 'auth/login') {
      if (String(body.email || '').trim().toLowerCase() !== LOGIN.email || body.password !== LOGIN.password) err('E-mail ou senha inválidos', 401);
      db.logged = true; return { name: LOGIN.name };
    }
    if (path === 'auth/logout') { db.logged = false; return { ok: true }; }
    // ---------- público ----------
    if (path === 'public/store') {
      var show = s.show_sold_out === '1';
      return {
        settings: s, open: isOpen(), categories: db.categories.filter(function (c) { return c.active; }),
        products: db.products.filter(function (p) { return p.status !== 'rascunho'; }).map(function (p) { return Object.assign({}, p, { available: p.status === 'ativo' && p.stock_quantity > 0 }); }),
        neighborhoods: db.neighborhoods.filter(function (n) { return n.active; }),
      };
    }
    if (path === 'public/orders') {
      var name = String(body.name || '').trim(), phone = digits(body.phone);
      if (name.length < 3) err('Informe o nome completo'); if (phone.length < 10 || phone.length > 13) err('Telefone inválido');
      if (!body.street || !body.number) err('Informe rua e número'); if (!body.items || !body.items.length) err('Carrinho vazio');
      if (!isOpen()) err('A loja está fechada no momento');
      var nb = byId(db.neighborhoods, body.neighborhood_id); if (!nb) err('Bairro indisponível para entrega');
      var sub = 0, items = body.items.map(function (it) {
        var p = byId(db.products, it.product_id), qty = Math.floor(num(it.quantity));
        if (!p || p.status !== 'ativo') err('Produto indisponível'); if (qty > p.stock_quantity) err('Estoque insuficiente de ' + p.name + ' (disponível: ' + p.stock_quantity + ')');
        sub += price(p) * qty; return { product_id: p.id, name: p.name, quantity: qty, unit_price: price(p), unit_cost: num(p.current_cost) };
      });
      var fee = num(s.free_delivery_above) > 0 && sub >= num(s.free_delivery_above) ? 0 : num(nb.delivery_fee);
      var cust = db.customers.find(function (c) { return c.phone === phone; });
      if (!cust) { cust = { id: ++db.seq.cust, phone: phone, first_order_at: now() }; db.customers.push(cust); }
      Object.assign(cust, { name: name, neighborhood_id: nb.id, street: body.street, number: body.number, complement: body.complement || null, reference: body.reference || null, last_order_at: now() });
      var o = {
        id: ++db.seq.order, order_number: ++db.seq.num, customer_id: cust.id, customer_name: name, customer_phone: phone, neighborhood_name: nb.name,
        address: [body.street, body.number, body.complement].filter(Boolean).join(', '), subtotal: sub, delivery_fee: fee, total: sub + fee,
        payment_method: body.payment_method || null, change_for: /dinheiro/i.test(body.payment_method || '') && num(body.change_for) > sub + fee ? num(body.change_for) : null, payment_status: 'pendente', status: 'aguardando', source: 'site', notes: body.notes || null,
        lat: body.lat ? num(body.lat) : nb.lat + (Math.random() - 0.5) * 0.012, lng: body.lng ? num(body.lng) : nb.lng + (Math.random() - 0.5) * 0.012, items: items, stock_applied: false, created_at: now(),
      };
      db.orders.unshift(o);
      var txt = '*NOVO PEDIDO — NO SILVA DRINKS*\nPedido: #' + String(o.order_number).padStart(6, '0') + '\nCliente: ' + name + '\n' + items.map(function (i) { return i.quantity + 'x ' + i.name; }).join('\n') + '\nTOTAL: R$ ' + o.total.toFixed(2);
      return { order_number: o.order_number, total: o.total, whatsapp_url: 'https://wa.me/' + digits(s.whatsapp) + '?text=' + encodeURIComponent(txt) };
    }
    if (path === 'public/customer') {
      var cp = digits(q.get('phone')); if (cp.length < 10) err('Informe o telefone com DDD');
      var cu = db.customers.find(function (c) { return c.phone && c.phone.slice(-10) === cp.slice(-10); });
      if (!cu) return { found: false };
      return { found: true, name: cu.name, neighborhood_id: cu.neighborhood_id, street: cu.street, number: cu.number, complement: cu.complement, reference: cu.reference };
    }
    if (path === 'public/track') {
      var ph = digits(q.get('phone')); if (ph.length < 10) err('Informe o telefone com DDD');
      var t = db.orders.filter(function (o) { return o.customer_phone && o.customer_phone.slice(-10) === ph.slice(-10); }).sort(function (a, b) { return b.id - a.id; })[0];
      if (!t) err('Nenhum pedido encontrado para este telefone', 404);
      return { order_number: t.order_number, status: t.status, total: t.total, created_at: t.created_at, out_for_delivery_at: t.out_for_delivery_at, delivered_at: t.delivered_at, items: t.items, auto_deliver_minutes: num(s.auto_deliver_minutes) || 40 };
    }
    // ---------- admin (precisa login) ----------
    if (!db.logged) err('Não autenticado', 401);
    if (path === 'auth/me') return { name: LOGIN.name, email: LOGIN.email };
    if (path === 'auth/password') err('Na pré-visualização a senha é fixa. Troque na VPS.');
    if (!path.startsWith('admin/')) err('Não encontrado', 404);
    path = path.slice(6);
    if (path === 'upload') err('Na pré-visualização use a opção de URL da imagem');
    if (path === 'reset') {
      if (body.password !== LOGIN.password) err('Senha incorreta', 401);
      var w = body.what || []; if (!w.length) err('Escolha o que deseja zerar');
      var has = function (k) { return w.indexOf(k) >= 0 || (w.indexOf('produtos') >= 0 && (k === 'estoque' || k === 'pedidos')); };
      if (has('financeiro')) db.finance = [];
      if (has('pedidos')) { db.finance = db.finance.filter(function (f) { return !f.order_id; }); db.orders = []; db.customers = []; db.seq.num = 0; }
      if (has('estoque')) { db.finance = db.finance.filter(function (f) { return !f.stock_movement_id; }); db.movements = []; db.products.forEach(function (p) { p.stock_quantity = 0; }); }
      if (has('produtos')) db.products = [];
      return { ok: true };
    }
    if (path === 'settings') { if (method === 'PUT') Object.assign(s, body); return s; }
    if ((m = path.match(/^categories(?:\/(\d+))?$/))) {
      if (method === 'GET') return db.categories;
      r = m[1] ? byId(db.categories, m[1]) : (db.categories.push({ id: ++db.seq.cat }), db.categories[db.categories.length - 1]);
      return Object.assign(r, body, { sort_order: num(body.sort_order) });
    }
    if ((m = path.match(/^products(?:\/(\d+))?$/))) {
      if (method === 'GET') return db.products.map(function (p) {
        var c = byId(db.categories, p.category_id), mv = db.movements.filter(function (x) { return x.product_id === p.id; });
        return Object.assign({}, p, { category_name: c ? c.name : null, total_bought: mv.filter(function (x) { return x.type === 'entrada'; }).reduce(function (a, x) { return a + x.quantity; }, 0), total_out: -mv.filter(function (x) { return x.type !== 'entrada'; }).reduce(function (a, x) { return a + x.quantity; }, 0) });
      });
      if (method === 'DELETE') { db.products = db.products.filter(function (x) { return String(x.id) !== String(m[1]); }); return { ok: true }; }
      var fields = { category_id: num(body.category_id) || null, name: body.name, description: body.description, image: body.image, unit: body.unit || 'un', sale_price: num(body.sale_price), promo_price: body.promo_price ? num(body.promo_price) : null, current_cost: num(body.current_cost), minimum_stock: num(body.minimum_stock), status: body.status || 'ativo', featured: !!body.featured, sort_order: num(body.sort_order) };
      if (m[1]) return Object.assign(byId(db.products, m[1]), fields);
      var np = Object.assign({ id: ++db.seq.prod, stock_quantity: 0 }, fields); db.products.push(np);
      if (num(body.stock_quantity) > 0) moveStock({ product_id: np.id, type: 'entrada', quantity: Math.floor(num(body.stock_quantity)), unit_cost: np.current_cost, notes: 'Estoque inicial' });
      return np;
    }
    if (path === 'stock/entry') {
      var qe = Math.floor(num(body.quantity)); if (qe < 1) err('Quantidade inválida');
      var tc = num(body.total_cost), mv = moveStock({ product_id: body.product_id, type: 'entrada', quantity: qe, unit_cost: tc / qe, supplier: body.supplier, notes: body.notes });
      byId(db.products, body.product_id).current_cost = tc / qe;
      if (tc > 0) addFin({ type: 'saida', category: 'Reposição de estoque', description: 'Compra: ' + qe + ' un' + (body.supplier ? ' — ' + body.supplier : ''), amount: tc, payment_method: body.payment_method || null, entry_date: body.date || today(), stock_movement_id: mv.id });
      return mv;
    }
    if (path === 'stock/out') { var qo = Math.floor(num(body.quantity)); if (qo < 1) err('Quantidade inválida'); return moveStock({ product_id: body.product_id, type: 'saida', quantity: qo, notes: body.notes || 'Baixa rápida' }); }
    if ((m = path.match(/^stock\/revert\/(\d+)$/))) {
      var om = byId(db.movements, m[1]); if (!om || om.reverted || ['estorno', 'venda', 'estorno_venda'].indexOf(om.type) >= 0) err('Movimentação não pode ser estornada');
      var pr = byId(db.products, om.product_id); if (pr.stock_quantity - om.quantity < 0) err('Estoque insuficiente para estornar');
      pr.stock_quantity -= om.quantity; om.reverted = true; db.finance = db.finance.filter(function (f) { return f.stock_movement_id !== om.id; });
      var em = { id: ++db.seq.mv, product_id: pr.id, product_name: pr.name, type: 'estorno', quantity: -om.quantity, notes: 'Estorno da movimentação #' + om.id, user_name: LOGIN.name, created_at: now() };
      db.movements.unshift(em); return em;
    }
    if (path === 'stock/movements') return db.movements.filter(function (x) { return !q.get('product_id') || String(x.product_id) === q.get('product_id'); }).slice(0, 300);
    if (path === 'orders/last') return { id: db.orders.filter(function (o) { return o.source === 'site'; }).reduce(function (a, o) { return Math.max(a, o.id); }, 0) };
    if (path === 'orders/live') {
      var td = today();
      return {
        orders: db.orders.filter(function (o) { return dateOf(o.created_at) === td || ['aguardando', 'confirmado', 'preparo', 'saiu'].indexOf(o.status) >= 0; }),
        last_site_id: handle('GET', 'admin/orders/last', q, {}).id, auto_deliver_minutes: num(s.auto_deliver_minutes) || 40,
        store: { address: s.store_address, lat: s.store_lat ? Number(s.store_lat) : null, lng: s.store_lng ? Number(s.store_lng) : null },
      };
    }
    if (path === 'orders/manual') {
      if (!body.items || !body.items.length) err('Adicione produtos');
      var ms = 0, mi = body.items.map(function (it) { var p = byId(db.products, it.product_id), qq = Math.floor(num(it.quantity)); if (!p || qq < 1) err('Item inválido'); var up = it.unit_price !== undefined && it.unit_price !== '' ? num(it.unit_price) : price(p); ms += up * qq; return { product_id: p.id, name: p.name, quantity: qq, unit_price: up, unit_cost: num(p.current_cost) }; });
      var mo = { id: ++db.seq.order, order_number: ++db.seq.num, customer_name: body.customer_name || 'Venda balcão', customer_phone: digits(body.customer_phone) || null, subtotal: ms, delivery_fee: num(body.delivery_fee), total: ms + num(body.delivery_fee), payment_method: body.payment_method || 'Dinheiro', payment_status: 'pendente', status: 'aguardando', source: 'manual', notes: body.notes || null, items: mi, stock_applied: false, created_at: now() };
      db.orders.unshift(mo); setStatus(mo.id, 'entregue', body.paid === false ? 'pendente' : 'pago'); return mo;
    }
    if ((m = path.match(/^orders\/(\d+)\/locate$/))) { var lo = byId(db.orders, m[1]); lo.lat = num(body.lat); lo.lng = num(body.lng); return { ok: true }; }
    if ((m = path.match(/^orders\/(\d+)$/))) {
      if (method === 'DELETE') { var dor = byId(db.orders, m[1]); if (dor.stock_applied) setStatus(dor.id, 'cancelado'); db.finance = db.finance.filter(function (f) { return f.order_id !== dor.id; }); db.orders = db.orders.filter(function (o) { return o !== dor; }); return { ok: true }; }
      setStatus(m[1], body.status, body.payment_status); return { ok: true };
    }
    if (path === 'orders') return db.orders.filter(function (o) { return (!q.get('status') || o.status === q.get('status')) && inRange(dateOf(o.created_at), q); }).map(function (o) { return Object.assign({}, o, { cost: o.items.reduce(function (a, i) { return a + i.quantity * i.unit_cost; }, 0) }); });
    if ((m = path.match(/^neighborhoods(?:\/(\d+))?$/))) {
      if (method === 'GET') return db.neighborhoods;
      if (method === 'DELETE') { byId(db.neighborhoods, m[1]).active = false; return { ok: true }; }
      r = m[1] ? byId(db.neighborhoods, m[1]) : (db.neighborhoods.push({ id: ++db.seq.nb, lat: -29.7604, lng: -51.1472 }), db.neighborhoods[db.neighborhoods.length - 1]);
      return Object.assign(r, body, { delivery_fee: num(body.delivery_fee) });
    }
    if ((m = path.match(/^finance(?:\/(\d+))?$/))) {
      if (method === 'GET') return db.finance.filter(function (f) { return inRange(f.entry_date, q); });
      if (method === 'DELETE') { db.finance = db.finance.filter(function (f) { return !(String(f.id) === m[1] && !f.order_id && !f.stock_movement_id); }); return { ok: true }; }
      if (['entrada', 'saida'].indexOf(body.type) < 0 || num(body.amount) <= 0) err('Dados inválidos');
      return addFin({ type: body.type, category: body.category || 'Outros', description: body.description, amount: num(body.amount), payment_method: body.payment_method, notes: body.notes, entry_date: body.entry_date || today() });
    }
    if ((m = path.match(/^customers\/(\d+)\/orders$/))) return db.orders.filter(function (o) { return String(o.customer_id) === m[1]; });
    if (path === 'customers') return db.customers.map(function (c) {
      var os = db.orders.filter(function (o) { return o.customer_id === c.id && o.status !== 'cancelado'; }), n = byId(db.neighborhoods, c.neighborhood_id);
      return Object.assign({}, c, { neighborhood: n ? n.name : null, orders_count: os.length, total_spent: os.reduce(function (a, o) { return a + o.total; }, 0) });
    });
    if (path === 'dashboard') {
      var from = q.get('from') || today(), to = q.get('to') || from;
      var conf = db.orders.filter(function (o) { var d = dateOf(o.created_at); return o.stock_applied && d >= from && d <= to; });
      var sum = function (a, f) { return a.reduce(function (t, x) { return t + num(f(x)); }, 0); };
      var allItems = []; conf.forEach(function (o) { o.items.forEach(function (i) { allItems.push(i); }); });
      var fin = db.finance.filter(function (f) { return f.entry_date >= from && f.entry_date <= to; });
      var K = {
        sales: conf.length, products_rev: sum(conf, function (o) { return o.subtotal; }), delivery_rev: sum(conf, function (o) { return o.delivery_fee; }), gross: sum(conf, function (o) { return o.total; }),
        received: sum(conf.filter(function (o) { return o.payment_status === 'pago'; }), function (o) { return o.total; }), pending_amount: sum(conf.filter(function (o) { return o.payment_status !== 'pago'; }), function (o) { return o.total; }),
        cmv: sum(allItems, function (i) { return i.quantity * i.unit_cost; }), items_sold: sum(allItems, function (i) { return i.quantity; }),
        investments: sum(fin.filter(function (f) { return f.type === 'saida' && f.category === 'Reposição de estoque'; }), function (f) { return f.amount; }),
        expenses: sum(fin.filter(function (f) { return f.type === 'saida' && f.category !== 'Reposição de estoque'; }), function (f) { return f.amount; }),
        other_income: sum(fin.filter(function (f) { return f.type === 'entrada' && !f.order_id; }), function (f) { return f.amount; }),
        cash_in: sum(fin.filter(function (f) { return f.type === 'entrada'; }), function (f) { return f.amount; }), cash_out: sum(fin.filter(function (f) { return f.type === 'saida'; }), function (f) { return f.amount; }),
        pending: db.orders.filter(function (o) { return o.status === 'aguardando'; }).length,
        done: db.orders.filter(function (o) { var d = dateOf(o.created_at); return o.status === 'entregue' && d >= from && d <= to; }).length,
        customers: db.customers.length, low_stock: db.products.filter(function (p) { return p.status !== 'rascunho' && p.stock_quantity <= 0; }),
      };
      K.gross_profit = K.products_rev - K.cmv; K.net_profit = K.gross_profit + K.delivery_rev + K.other_income - K.expenses;
      var daily = []; for (var d = new Date(from + 'T12:00:00'); dateOf(d) <= to && daily.length < 400; d.setDate(d.getDate() + 1)) { var ds = dateOf(d); daily.push({ day: ds, total: sum(conf.filter(function (o) { return dateOf(o.created_at) === ds; }), function (o) { return o.total; }) }); }
      var top = {}; allItems.forEach(function (i) { top[i.name] = top[i.name] || { name: i.name, qty: 0, total: 0 }; top[i.name].qty += i.quantity; top[i.name].total += i.quantity * i.unit_price; });
      var cats = {}; allItems.forEach(function (i) { var p = byId(db.products, i.product_id), c = p && byId(db.categories, p.category_id), n = c ? c.name : 'Sem categoria'; cats[n] = (cats[n] || 0) + i.quantity * i.unit_price; });
      var monthly = []; for (var k = 11; k >= 0; k--) { var md = new Date(); md.setDate(1); md.setMonth(md.getMonth() - k); var mk = dateOf(md).slice(0, 7); var mo2 = db.orders.filter(function (o) { return o.stock_applied && dateOf(o.created_at).slice(0, 7) === mk; }); monthly.push({ month: mk.slice(5) + '/' + mk.slice(0, 4), revenue: sum(mo2, function (o) { return o.total; }), gross_profit: sum(mo2, function (o) { return sum(o.items, function (i) { return i.quantity * (i.unit_price - i.unit_cost); }); }), expenses: sum(db.finance.filter(function (f) { return f.type === 'saida' && f.category !== 'Reposição de estoque' && f.entry_date.slice(0, 7) === mk; }), function (f) { return f.amount; }) }); }
      return Object.assign(K, { daily: daily, top_products: Object.values(top).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 8), categories: Object.keys(cats).map(function (n) { return { name: n, total: cats[n] }; }), monthly: monthly });
    }
    err('Não encontrado', 404);
  }

  var orig = window.fetch.bind(window);
  window.fetch = function (url, opt) {
    var u = new URL(String(url), location.href), i = u.pathname.indexOf('/api/');
    if (i === -1) return orig(url, opt);
    opt = opt || {};
    var method = (opt.method || 'GET').toUpperCase(), body = {};
    try { if (typeof opt.body === 'string') body = JSON.parse(opt.body); } catch (e) {}
    var status = 200, out;
    try { out = handle(method, u.pathname.slice(i + 5), u.searchParams, body); save(); }
    catch (e) { status = e.status || 500; out = { error: e.message }; }
    return Promise.resolve(new Response(JSON.stringify(out), { status: status, headers: { 'Content-Type': 'application/json' } }));
  };
  // Aviso fixo no painel da pré-visualização: aqui os dados ficam só neste navegador
  if (location.pathname.indexOf('/admin') >= 0) document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.textContent = '⚠️ PRÉ-VISUALIZAÇÃO — o que você cadastra aqui fica só neste navegador. Cadastre seus produtos reais no painel do seu domínio.';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b45309;color:#fff;font:600 13px system-ui;padding:8px 12px;text-align:center';
    document.body.appendChild(b);
  });
})();
