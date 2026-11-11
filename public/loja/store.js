(() => {
  const $ = (s) => document.querySelector(s);
  const brl = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const img = (u) => (u ? (/^(https?:|data:)/.test(u) ? u : u) : '');
  let S = { settings: {}, products: [], categories: [], neighborhoods: [], open: true };
  let cat = 'all', term = '', view = 'cart';
  let cart = JSON.parse(localStorage.getItem('nsd_cart') || '{}');
  const saved = JSON.parse(localStorage.getItem('nsd_customer') || '{}');

  const save = () => localStorage.setItem('nsd_cart', JSON.stringify(cart));
  const priceOf = (p) => (p.promo_price && +p.promo_price > 0 ? +p.promo_price : +p.sale_price);
  const prod = (id) => S.products.find((p) => p.id == id);
  const items = () => Object.entries(cart).map(([id, q]) => ({ p: prod(id), q })).filter((x) => x.p && x.p.available);
  const PR = window.NSDPromo;
  const promoNow = () => (PR ? PR.promoMap(S.promotions || [], PR.spNow()) : {});
  const priced = () => (PR ? PR.priceCart(items().map((x) => ({ product_id: x.p.id, quantity: x.q, price: priceOf(x.p), name: x.p.name })), S.promotions || [], PR.spNow()) : { items: items().map((x) => ({ product_id: x.p.id, quantity: x.q, unit_price: priceOf(x.p) })), subtotal: items().reduce((a, x) => a + priceOf(x.p) * x.q, 0), discount: 0 });
  const subtotal = () => priced().subtotal;
  const promoTxt = (pr) => `1 por ${brl(pr.price1)}${+pr.price2 ? ` · 2 por ${brl(pr.price2)}` : ''}`;
  const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600); };

  function setQty(id, q) {
    const p = prod(id); if (!p) return;
    q = Math.max(0, Math.min(q, p.stock_quantity));
    if (q === 0) delete cart[id]; else cart[id] = q;
    if (q === p.stock_quantity && q > 0) toast('Quantidade máxima em estoque');
    save(); renderBadge(); renderGrid(); if ($('#drawer').classList.contains('open')) renderDrawer();
  }

  // ---------- Destaques do dia (faixa no topo; não esconde nenhum produto) ----------
  let hlTimer = null;
  function renderHighlights() {
    const box = $('#hl'); if (!box) return;
    const pm = promoNow(), list = (S.highlights || []).map((h) => ({ h, p: prod(h.product_id) })).filter((x) => x.p);
    if (!list.length) { box.hidden = true; clearInterval(hlTimer); return; }
    box.hidden = false;
    if (PR && S.now) $('#hlDay').textContent = PR.DAYS[PR.spNow().dow].toUpperCase();
    $('#hlTrack').innerHTML = list.map(({ h, p }) => { const dp = pm[p.id]; return `<button type="button" class="hl-item" data-goto="${p.id}">
      <span class="hl-img">${h.image ? `<img src="${esc(img(h.image))}" alt="${esc(p.name)}" loading="lazy">` : `<span class="ph">${esc(p.name[0])}</span>`}</span>
      <span class="hl-name">${esc(p.name)}</span>
      <span class="hl-tag ${dp ? "is-promo" : ""}">${dp ? `1 por ${brl(dp.price1)}${+dp.price2 ? `<br>2 por ${brl(dp.price2)}` : ""}` : !p.available ? 'ESGOTADO' : brl(priceOf(p))}</span></button>`; }).join('');
    const tr = $('#hlTrack'), step = () => Math.max(140, tr.clientWidth * 0.8);
    const move = (d) => { const end = tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 4; tr.scrollTo({ left: d > 0 && end ? 0 : tr.scrollLeft + d * step(), behavior: 'smooth' }); };
    on('#hlPrev', () => move(-1)); on('#hlNext', () => move(1));
    clearInterval(hlTimer);
    if (tr.scrollWidth > tr.clientWidth + 4 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let pause = false; tr.onpointerenter = tr.ontouchstart = () => (pause = true); tr.onpointerleave = () => (pause = false);
      hlTimer = setInterval(() => !pause && !document.hidden && move(1), 3500);
    }
    const promos = PR ? (S.promotions || []).filter((x) => PR.promoActive(x, PR.spNow()) && x.product_ids.length) : [];
    const bar = $('#promoBar'); if (bar) { bar.hidden = !promos.length; bar.innerHTML = promos.map((x) => `<span>🎉 <b>${esc(x.name)}</b> — ${promoTxt(x)} (podem misturar os sabores da promoção)</span>`).join(''); }
  }
  function gotoProduct(id) {
    cat = 'all'; term = ''; const se = $('#search'); if (se) se.value = ''; renderTabs(); renderGrid();
    const el = document.getElementById('prod-' + id); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  function renderBadge() {
    const n = Object.values(cart).reduce((a, b) => a + b, 0), b = $('#cartCount');
    b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    $('#fabTotal').textContent = brl(subtotal());
    $('#fab').classList.toggle('show', n > 0);
  }

  function renderTabs() {
    const t = [{ id: 'all', name: 'TODOS' }, ...S.categories];
    $('#tabs').innerHTML = t.map((c) => `<button class="tab ${cat == c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  }

  function renderGrid() {
    let list = S.products.filter((p) => (cat === 'all' || p.category_id == cat) && (!term || (p.name + ' ' + (p.description || '')).toLowerCase().includes(term)));
    list.sort((a, b) => (b.available - a.available) || (b.featured - a.featured));
    const pm = promoNow();
    $('#grid').innerHTML = list.length ? list.map((p) => {
      const q = cart[p.id] || 0, promo = p.promo_price && +p.promo_price > 0, dp = pm[p.id];
      return `<article class="card ${p.available ? '' : 'soldout'}" data-id="${p.id}" id="prod-${p.id}">
        ${!p.available ? '<span class="tag out">ESGOTADO</span>' : dp ? '<span class="tag tag-day">🎉 PROMO DO DIA</span>' : promo ? '<span class="tag">PROMO</span>' : p.featured ? '<span class="tag">DESTAQUE</span>' : ''}
        <div class="card-img">${p.image ? `<img src="${esc(img(p.image))}" alt="${esc(p.name)}" loading="lazy">` : `<span class="ph">${esc(p.name[0])}</span>`}</div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3><p class="desc">${esc(p.description || '')}</p>
          <div class="price"><b>${brl(dp ? dp.price1 : priceOf(p))}</b>${dp && +dp.price1 < priceOf(p) ? `<s>${brl(priceOf(p))}</s>` : !dp && promo ? `<s>${brl(p.sale_price)}</s>` : ''}</div>
          ${dp ? `<div class="day-promo"><b>${esc(dp.name)}</b><span>${promoTxt(dp)}</span></div>` : ''}
          <div class="card-actions">${!p.available ? '<button class="btn btn-ghost" disabled>INDISPONÍVEL</button>'
            : q ? `<div class="qty" style="flex:1"><button data-dec>−</button><span>${q}</span><button data-inc>+</button></div>`
            : `<button class="btn btn-primary" data-add>ADICIONAR</button>`}</div>
        </div></article>`;
    }).join('') : '<p class="empty">Nenhum produto encontrado.</p>';
  }

  function cartView() {
    const it = items();
    $('#drawerTitle').textContent = 'SEU CARRINHO';
    if (!it.length) { $('#drawerBody').innerHTML = '<p class="empty">Seu carrinho está vazio 🍻</p>'; $('#drawerFoot').innerHTML = '<button class="btn btn-primary" data-close>VER PRODUTOS</button>'; return; }
    const pc = priced(), lineTot = (id) => pc.items.filter((x) => x.product_id == id).reduce((a, x) => a + x.unit_price * x.quantity, 0);
    const lineProm = (id) => (pc.items.find((x) => x.product_id == id && x.promotion) || {}).promotion;
    $('#drawerBody').innerHTML = it.map(({ p, q }) => `<div class="line" data-id="${p.id}">
      ${p.image ? `<img src="${esc(img(p.image))}" alt="">` : `<div class="mini">${esc(p.name[0])}</div>`}
      <div class="info"><b>${esc(p.name)}</b><small>${brl(lineTot(p.id))}${lineProm(p.id) ? ` <span class="line-promo">🎉 ${esc(lineProm(p.id))}</span>` : ''}</small></div>
      <div class="qty"><button data-dec>−</button><span>${q}</span><button data-inc>+</button></div></div>`).join('');
    const st = subtotal(), min = +S.settings.min_order || 0, free = +S.settings.free_delivery_above || 0;
    $('#drawerFoot').innerHTML = `${pc.discount > 0 ? `<div class="row promo-row"><span>🎉 Desconto das promoções</span><span>− ${brl(pc.discount)}</span></div>` : ''}<div class="row"><span>Subtotal</span><span>${brl(st)}</span></div>
      <div class="row"><span>Entrega</span><span>calculada no próximo passo</span></div>
      ${free ? `<div class="row"><span>🎁 Entrega grátis acima de</span><span>${brl(free)}</span></div>` : ''}
      ${min && st < min ? `<div class="alert">Pedido mínimo: ${brl(min)}</div>` : ''}
      ${!S.open ? '<div class="alert">Estamos fechados agora. Volte no horário de funcionamento.</div>' : ''}
      <button class="btn btn-primary" data-checkout ${(min && st < min) || !S.open ? 'disabled' : ''}>FINALIZAR PEDIDO →</button>`;
  }

  function phoneView(err) {
    $('#drawerTitle').textContent = 'SEU TELEFONE';
    $('#drawerBody').innerHTML = `<form class="form" id="phoneForm" novalidate>
      ${err ? `<div class="alert field full">${esc(err)}</div>` : ''}
      <p class="field full muted">Digite seu WhatsApp. Se você já pediu antes, preenchemos seus dados e endereço automaticamente.</p>
      <div class="field full"><label>Telefone / WhatsApp com DDD *</label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(51) 99999-9999" value="${esc(saved.phone || '')}"></div>
    </form>`;
    $('#drawerFoot').innerHTML = `<button class="btn btn-primary" data-phone-go>CONTINUAR →</button><button class="btn btn-ghost" data-back>← Voltar ao carrinho</button>`;
    const f = $('#phoneForm'); f.onsubmit = (e) => { e.preventDefault(); lookupPhone(); }; setTimeout(() => f.phone.focus(), 50);
  }
  let welcome = '';
  async function lookupPhone() {
    const f = $('#phoneForm'), phone = f.phone.value.trim(), dg = phone.replace(/\D/g, '');
    if (dg.length < 10) return phoneView('Informe o telefone com DDD.');
    const b = $('[data-phone-go]'); if (b) { b.disabled = true; b.textContent = 'Buscando…'; }
    let c = { found: false };
    try { const r = await fetch('/api/public/customer?phone=' + encodeURIComponent(dg)); if (r.ok) c = await r.json(); } catch {}
    const prev = (saved.phone || '').replace(/\D/g, '').slice(-10) === dg.slice(-10);
    if (c.found) {
      for (const k of ['name', 'neighborhood_id', 'street', 'number', 'complement', 'reference']) saved[k] = c[k] == null ? '' : String(c[k]);
      welcome = `👋 Olá, ${(c.name || '').split(' ')[0]}! Encontramos seu cadastro. Confira os dados e o endereço.`;
    } else {
      if (!prev) for (const k of ['name', 'neighborhood_id', 'street', 'number', 'complement', 'reference']) saved[k] = '';
      welcome = '🆕 Primeira vez por aqui? Preencha seu nome e endereço.';
    }
    saved.phone = phone; view = 'checkout'; checkoutView();
  }
  function checkoutView(err) {
    $('#drawerTitle').textContent = 'FINALIZAR';
    const nbs = S.neighborhoods, pm = (S.settings.payment_methods || 'Pix,Dinheiro,Cartão').split(',').map((s) => s.trim()).filter(Boolean);
    const v = (k) => esc(saved[k] || '');
    $('#drawerBody').innerHTML = `<form class="form" id="checkout" novalidate>
      ${err ? `<div class="alert field full">${esc(err)}</div>` : welcome ? `<div class="welcome field full">${esc(welcome)}</div>` : ''}
      <div class="field full"><label>Nome completo *</label><input name="name" required autocomplete="name" value="${v('name')}"></div>
      <div class="field full"><label>Telefone / WhatsApp *</label><input name="phone" required inputmode="tel" autocomplete="tel" placeholder="(51) 99999-9999" value="${v('phone')}"></div>
      <div class="field full"><label>Bairro *</label><select name="neighborhood_id" required><option value="">Selecione…</option>
        ${nbs.map((n) => `<option value="${n.id}" ${saved.neighborhood_id == n.id ? 'selected' : ''}>${esc(n.name)} — ${+n.delivery_fee ? brl(n.delivery_fee) : 'Grátis'}${n.estimated_minutes ? ` · ~${n.estimated_minutes} min` : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Rua *</label><input name="street" required autocomplete="address-line1" value="${v('street')}"></div>
      <div class="field"><label>Número *</label><input name="number" required value="${v('number')}"></div>
      <div class="field"><label>Complemento</label><input name="complement" value="${v('complement')}"></div>
      <div class="field"><label>Referência</label><input name="reference" value="${v('reference')}"></div>
      <div class="field full"><label>Forma de pagamento *</label><div class="pay-opts">${pm.map((p, k) => `<label class="pay-opt"><input type="radio" name="payment_method" value="${esc(p)}" ${(saved.payment_method ? saved.payment_method === p : k === 0) ? 'checked' : ''}><span>${/pix/i.test(p) ? '⚡' : /dinheiro/i.test(p) ? '💵' : '💳'} ${esc(p)}</span></label>`).join('')}</div></div>
      <div class="field full" id="cashBox" hidden><label>Precisa de troco?</label><div class="pay-opts"><label class="pay-opt"><input type="radio" name="need_change" value="0" checked><span>Não preciso</span></label><label class="pay-opt"><input type="radio" name="need_change" value="1"><span>Sim, preciso</span></label></div>
        <div id="changeBox" hidden style="margin-top:8px"><label>Troco para quanto?</label><input name="change_for" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Ex.: 100"><div id="changeCalc" class="change-calc"></div></div></div>
      <div class="field full"><label>Observações</label><textarea name="notes" rows="2" placeholder="Ex.: tocar a campainha, casa dos fundos…"></textarea></div>
    </form>`;
    const upd = (e) => {
      const f = $('#checkout'), nb = nbs.find((n) => n.id == f.neighborhood_id.value), st = subtotal(), free = +S.settings.free_delivery_above || 0;
      const fee = nb ? (free && st >= free ? 0 : +nb.delivery_fee) : null;
      const total = st + (fee || 0), pmv = (f.querySelector('[name=payment_method]:checked') || {}).value || '';
      const cash = /dinheiro/i.test(pmv), need = cash && f.querySelector('[name=need_change]:checked').value === '1';
      $('#cashBox').hidden = !cash; $('#changeBox').hidden = !need;
      const cf = +f.change_for.value || 0;
      $('#changeCalc').innerHTML = !need || !cf ? '' : cf < total ? `<span class="bad">O valor precisa ser maior que o total (${brl(total)})</span>` : `Total ${brl(total)} · você paga ${brl(cf)} · <b>troco: ${brl(cf - total)}</b>`;
      if (e && e.type === 'input') return;
      const html = `<div class="row"><span>Subtotal</span><span>${brl(st)}</span></div>
        <div class="row"><span>Taxa de entrega</span><span>${fee === null ? 'selecione o bairro' : fee ? brl(fee) : 'Grátis'}</span></div>
        <div class="row total"><span>TOTAL</span><span>${brl(st + (fee || 0))}</span></div>
        <button class="btn btn-primary" data-send>ENVIAR PEDIDO NO WHATSAPP</button>
        <button class="btn btn-ghost" data-back>← Voltar ao carrinho</button>`;
      if ($('#drawerFoot')._h !== html) { $('#drawerFoot').innerHTML = html; $('#drawerFoot')._h = html; }
    };
    $('#drawerFoot')._h = null; $('#checkout').addEventListener('change', upd); $('#checkout').addEventListener('input', upd); upd();
  }

  let pin = null;

  async function send(btn) {
    const f = $('#checkout'), d = Object.fromEntries(new FormData(f));
    if (!d.name || !d.phone || !d.neighborhood_id || !d.street || !d.number || !d.payment_method) return checkoutView('Preencha os campos obrigatórios (*).'), Object.assign(saved, d);
    if (d.need_change !== '1' || !/dinheiro/i.test(d.payment_method)) delete d.change_for;
    else { const nb = S.neighborhoods.find((n) => n.id == d.neighborhood_id), st = subtotal(), free = +S.settings.free_delivery_above || 0, tot = st + (free && st >= free ? 0 : +nb.delivery_fee); if (!(+d.change_for > tot)) return alert('Informe um valor de troco maior que o total (' + brl(tot) + ').'); }
    delete d.need_change;
    btn.disabled = true; btn.textContent = 'Enviando…';
    const { notes, change_for, ...keep } = d; localStorage.setItem('nsd_customer', JSON.stringify(keep)); Object.assign(saved, keep);
    // Abre a janela já no clique (evita bloqueio de pop-up no celular)
    const win = window.open('', '_blank');
    try {
      const r = await fetch('api/public/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, ...(pin || {}), items: items().map((x) => ({ product_id: x.p.id, quantity: x.q })) }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Erro ao enviar');
      if (win) win.location.href = j.whatsapp_url; else location.href = j.whatsapp_url;
      cart = {}; pin = null; save(); renderBadge(); load();
      $('#drawerTitle').textContent = 'PEDIDO ENVIADO';
      $('#drawerBody').innerHTML = `<div class="success"><div class="check">✓</div><h2>PEDIDO #${String(j.order_number).padStart(6, '0')}</h2>
        <p>Seu pedido foi registrado e preparado para envio no WhatsApp. <br>Status: <b>Aguardando confirmação</b>.</p>
        <a class="btn btn-primary" href="${esc(j.whatsapp_url)}" target="_blank" rel="noopener">ABRIR WHATSAPP NOVAMENTE</a></div>`;
      $('#drawerFoot').innerHTML = '<button class="btn btn-ghost" data-close>Fechar</button>';
    } catch (e) { if (win) win.close(); checkoutView(e.message); }
  }

  function renderDrawer() { view === 'cart' ? cartView() : view === 'phone' ? phoneView() : checkoutView(); }
  function openDrawer() { view = 'cart'; renderDrawer(); $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); document.body.style.overflow = ''; }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-cat]'); if (!t) return;
    if (t.dataset.goto) return gotoProduct(t.dataset.goto);
    const holder = t.closest('[data-id]'), id = holder && holder.dataset.id;
    if (t.dataset.cat) { cat = t.dataset.cat; renderTabs(); renderGrid(); }
    else if (t.hasAttribute('data-add')) { setQty(id, 1); const c = document.querySelector(`.card[data-id="${id}"]`); c && c.classList.add('added'); toast('Adicionado ao carrinho ✓'); }
    else if (t.hasAttribute('data-inc')) setQty(id, (cart[id] || 0) + 1);
    else if (t.hasAttribute('data-dec')) setQty(id, (cart[id] || 0) - 1);
    else if (t.hasAttribute('data-checkout')) { view = 'phone'; renderDrawer(); }
    else if (t.hasAttribute('data-phone-go')) lookupPhone();
    else if (t.hasAttribute('data-back')) { view = 'cart'; renderDrawer(); }
    else if (t.hasAttribute('data-send')) send(t);
    else if (t.hasAttribute('data-close')) closeDrawer();
  });
  // ---------- Acompanhar pedido pelo telefone ----------
  const STEPS = [['aguardando', 'Recebido', '📝'], ['preparo', 'Em preparação', '👨‍🍳'], ['saiu', 'A caminho', '🛵'], ['entregue', 'Entregue', '✅']];
  const stepIdx = (st) => (st === 'confirmado' ? 1 : STEPS.findIndex((x) => x[0] === st));
  function trackView(msg, o) {
    view = 'track'; $('#drawerTitle').textContent = 'MEU PEDIDO';
    let res = '';
    if (o) {
      const i = stepIdx(o.status);
      const eta = o.status === 'saiu' && o.out_for_delivery_at ? Math.max(1, o.auto_deliver_minutes - Math.round((Date.now() - new Date(o.out_for_delivery_at)) / 60000)) : null;
      res = o.status === 'cancelado'
        ? `<div class="track-card"><h3>PEDIDO #${String(o.order_number).padStart(6, '0')}</h3><p class="alert">Este pedido foi cancelado. Fale com a gente no WhatsApp.</p></div>`
        : `<div class="track-card"><h3>PEDIDO #${String(o.order_number).padStart(6, '0')}</h3>
          <p class="muted-s">Feito em ${new Date(o.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${brl(o.total)}</p>
          <ol class="steps">${STEPS.map((x, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}"><span>${x[2]}</span>${x[1]}</li>`).join('')}</ol>
          ${eta ? `<p class="eta">🛵 Seu pedido está a caminho! Chega em até ~${eta} min.</p>` : ''}
          <p class="muted-s">${o.items.map((it) => `${it.quantity}× ${esc(it.name)}`).join(' · ')}</p></div>`;
    }
    $('#drawerBody').innerHTML = `<p class="muted-s">Digite o telefone usado no pedido para ver como ele está.</p>
      <form id="trackForm" class="field"><label>WhatsApp com DDD</label><input name="phone" type="tel" inputmode="tel" required placeholder="(51) 99999-9999" value="${esc(saved.phone || '')}"></form>
      ${msg ? `<p class="alert">${esc(msg)}</p>` : ''}${res}`;
    $('#drawerFoot').innerHTML = '<button class="btn btn-primary" data-track>BUSCAR MEU ÚLTIMO PEDIDO</button><button class="btn btn-ghost" data-close>Fechar</button>';
    $('#trackForm').onsubmit = (e) => { e.preventDefault(); doTrack(); };
  }
  async function doTrack() {
    const phone = $('#trackForm [name=phone]').value;
    try {
      const r = await fetch('api/public/track?phone=' + encodeURIComponent(phone)); const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não foi possível buscar');
      saved.phone = phone; trackView('', j);
      $('#trackForm [name=phone]').value = phone;
    } catch (e) { trackView(e.message); $('#trackForm [name=phone]').value = phone; }
  }
  function openTrack() { trackView(); $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function on(sel, fn) { const el = document.querySelector(sel); if (el) el.onclick = fn; }
  on('#trackBtn2', openTrack);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-track]')) doTrack(); });

  on('#cartBtn', openDrawer); on('#fab', openDrawer); on('#closeDrawer', closeDrawer); on('#overlay', closeDrawer);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());
  $('#search').addEventListener('input', (e) => { term = e.target.value.toLowerCase().trim(); renderGrid(); });

  async function load() {
    try {
      S = await (await fetch('api/public/store')).json();
      const s = S.settings;
      if (s.logo) { $('#logo').src = s.logo; $('#logo').hidden = false; }
      if (s.favicon || s.logo) $('#favicon').href = s.favicon || s.logo;
      const hero = document.querySelector('.hero'); if (hero) hero.style.display = s.hero_enabled === '0' ? 'none' : '';
      if (s.hero_image) $('#heroImg').src = s.hero_image;
      if (s.hero_title) $('#heroTitle').textContent = s.hero_title;
      if (s.hero_subtitle) $('#heroSub').textContent = s.hero_subtitle;
      $('#tagline').textContent = $('#footTag').textContent = s.tagline || '';
      $('#waBtn').href = 'https://wa.me/' + String(s.whatsapp || '').replace(/\D/g, '');
      $('#status').className = 'status' + (S.open ? '' : ' closed');
      $('#status span').textContent = S.status_label || (S.open ? `Aberto até ${s.close_time}` : `Fechado · abre ${s.open_time}`);
      for (const id of Object.keys(cart)) { const p = prod(id); if (!p || !p.available) delete cart[id]; else if (cart[id] > p.stock_quantity) cart[id] = p.stock_quantity; }
      save(); renderTabs(); renderHighlights(); renderGrid(); renderBadge();
    } catch { $('#grid').innerHTML = '<p class="empty">Não foi possível carregar os produtos. Tente novamente.</p>'; }
  }
  load();
})();
