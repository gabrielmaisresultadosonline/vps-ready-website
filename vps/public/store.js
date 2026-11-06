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
  const subtotal = () => items().reduce((a, x) => a + priceOf(x.p) * x.q, 0);
  const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600); };

  function setQty(id, q) {
    const p = prod(id); if (!p) return;
    q = Math.max(0, Math.min(q, p.stock_quantity));
    if (q === 0) delete cart[id]; else cart[id] = q;
    if (q === p.stock_quantity && q > 0) toast('Quantidade máxima em estoque');
    save(); renderBadge(); renderGrid(); if ($('#drawer').classList.contains('open')) renderDrawer();
  }

  function renderBadge() {
    const n = Object.values(cart).reduce((a, b) => a + b, 0), b = $('#cartCount');
    b.textContent = n; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    $('#fabTotal').textContent = brl(subtotal());
    $('#fab').style.visibility = n ? 'visible' : 'hidden';
  }

  function renderTabs() {
    const t = [{ id: 'all', name: 'TODOS' }, ...S.categories];
    $('#tabs').innerHTML = t.map((c) => `<button class="tab ${cat == c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  }

  function renderGrid() {
    let list = S.products.filter((p) => (cat === 'all' || p.category_id == cat) && (!term || (p.name + ' ' + (p.description || '')).toLowerCase().includes(term)));
    list.sort((a, b) => (b.available - a.available) || (b.featured - a.featured));
    $('#grid').innerHTML = list.length ? list.map((p) => {
      const q = cart[p.id] || 0, promo = p.promo_price && +p.promo_price > 0;
      return `<article class="card ${p.available ? '' : 'soldout'}" data-id="${p.id}">
        ${!p.available ? '<span class="tag out">ESGOTADO</span>' : promo ? '<span class="tag">PROMO</span>' : p.featured ? '<span class="tag">DESTAQUE</span>' : ''}
        <div class="card-img">${p.image ? `<img src="${esc(img(p.image))}" alt="${esc(p.name)}" loading="lazy">` : `<span class="ph">${esc(p.name[0])}</span>`}</div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3><p class="desc">${esc(p.description || '')}</p>
          <div class="price"><b>${brl(priceOf(p))}</b>${promo ? `<s>${brl(p.sale_price)}</s>` : ''}</div>
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
    $('#drawerBody').innerHTML = it.map(({ p, q }) => `<div class="line" data-id="${p.id}">
      ${p.image ? `<img src="${esc(img(p.image))}" alt="">` : `<div class="mini">${esc(p.name[0])}</div>`}
      <div class="info"><b>${esc(p.name)}</b><small>${brl(priceOf(p) * q)}</small></div>
      <div class="qty"><button data-dec>−</button><span>${q}</span><button data-inc>+</button></div></div>`).join('');
    const st = subtotal(), min = +S.settings.min_order || 0, free = +S.settings.free_delivery_above || 0;
    $('#drawerFoot').innerHTML = `<div class="row"><span>Subtotal</span><span>${brl(st)}</span></div>
      <div class="row"><span>Entrega</span><span>calculada no próximo passo</span></div>
      ${free ? `<div class="row"><span>🎁 Entrega grátis acima de</span><span>${brl(free)}</span></div>` : ''}
      ${min && st < min ? `<div class="alert">Pedido mínimo: ${brl(min)}</div>` : ''}
      ${!S.open ? '<div class="alert">Estamos fechados agora. Volte no horário de funcionamento.</div>' : ''}
      <button class="btn btn-primary" data-checkout ${(min && st < min) || !S.open ? 'disabled' : ''}>FINALIZAR PEDIDO →</button>`;
  }

  function checkoutView(err) {
    $('#drawerTitle').textContent = 'FINALIZAR';
    const nbs = S.neighborhoods, pm = (S.settings.payment_methods || 'Pix,Dinheiro,Cartão').split(',').map((s) => s.trim()).filter(Boolean);
    const v = (k) => esc(saved[k] || '');
    $('#drawerBody').innerHTML = `<form class="form" id="checkout" novalidate>
      ${err ? `<div class="alert field full">${esc(err)}</div>` : ''}
      <div class="field full"><label>Nome completo *</label><input name="name" required autocomplete="name" value="${v('name')}"></div>
      <div class="field full"><label>Telefone / WhatsApp *</label><input name="phone" required inputmode="tel" autocomplete="tel" placeholder="(51) 99999-9999" value="${v('phone')}"></div>
      <div class="field full"><label>Bairro *</label><select name="neighborhood_id" required><option value="">Selecione…</option>
        ${nbs.map((n) => `<option value="${n.id}" ${saved.neighborhood_id == n.id ? 'selected' : ''}>${esc(n.name)} — ${+n.delivery_fee ? brl(n.delivery_fee) : 'Grátis'}${n.estimated_minutes ? ` · ~${n.estimated_minutes} min` : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Rua *</label><input name="street" required autocomplete="address-line1" value="${v('street')}"></div>
      <div class="field"><label>Número *</label><input name="number" required value="${v('number')}"></div>
      <div class="field"><label>Complemento</label><input name="complement" value="${v('complement')}"></div>
      <div class="field"><label>Referência</label><input name="reference" value="${v('reference')}"></div>
      <div class="field full"><label>Confirme sua localização no mapa</label>
        <div class="map-tools"><button type="button" class="btn btn-ghost" data-findmap>🔎 Buscar endereço no mapa</button><button type="button" class="btn btn-ghost" data-gps>📍 Usar minha localização</button></div>
        <div id="pinMap" class="pin-map" ${pin ? '' : 'hidden'}></div>
        <small id="pinMsg" class="pin-msg">${pin ? '✓ Local marcado. Arraste o pino ou toque no mapa para ajustar.' : 'Preencha bairro, rua e número e toque em “Buscar endereço no mapa”.'}</small></div>
      <div class="field full"><label>Forma de pagamento *</label><div class="pay-opts">${pm.map((p, k) => `<label class="pay-opt"><input type="radio" name="payment_method" value="${esc(p)}" ${(saved.payment_method ? saved.payment_method === p : k === 0) ? 'checked' : ''}><span>${/pix/i.test(p) ? '⚡' : /dinheiro/i.test(p) ? '💵' : '💳'} ${esc(p)}</span></label>`).join('')}</div></div>
      <div class="field full" id="cashBox" hidden><label>Precisa de troco?</label><div class="pay-opts"><label class="pay-opt"><input type="radio" name="need_change" value="0" checked><span>Não preciso</span></label><label class="pay-opt"><input type="radio" name="need_change" value="1"><span>Sim, preciso</span></label></div>
        <div id="changeBox" hidden style="margin-top:8px"><label>Troco para quanto?</label><input name="change_for" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Ex.: 100"><div id="changeCalc" class="change-calc"></div></div></div>
      <div class="field full"><label>Observações</label><textarea name="notes" rows="2" placeholder="Ex.: troco para R$ 50"></textarea></div>
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
    pmap = null; if (pin) showPin(pin.lat, pin.lng);
  }

  // ---------- Mapa de confirmação do endereço ----------
  let pin = null, pmap = null, pmark = null, leafletP = null;
  const loadLeaflet = () => leafletP || (leafletP = new Promise((ok, no) => {
    if (window.L) return ok();
    const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(c);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = ok; s.onerror = () => { leafletP = null; no(new Error('Mapa indisponível')); }; document.head.appendChild(s);
  }));
  const pinMsg = (t) => { const m = $('#pinMsg'); if (m) m.textContent = t; };
  async function showPin(lat, lng) {
    pin = { lat, lng };
    await loadLeaflet();
    const el = $('#pinMap'); if (!el) return; el.hidden = false;
    if (!pmap || pmap.getContainer() !== el) {
      pmap = L.map(el, { zoomControl: true }).setView([lat, lng], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(pmap);
      pmark = L.marker([lat, lng], { draggable: true }).addTo(pmap);
      pmark.on('dragend', () => { const p = pmark.getLatLng(); pin = { lat: p.lat, lng: p.lng }; pinMsg('✓ Local ajustado.'); });
      pmap.on('click', (e) => { pmark.setLatLng(e.latlng); pin = { lat: e.latlng.lat, lng: e.latlng.lng }; pinMsg('✓ Local ajustado.'); });
    } else { pmark.setLatLng([lat, lng]); pmap.setView([lat, lng], 17); }
    setTimeout(() => pmap && pmap.invalidateSize(), 60);
    pinMsg('✓ Confira se o pino está na sua casa. Arraste ou toque no mapa para ajustar.');
  }
  async function findOnMap() {
    const f = $('#checkout'); if (!f) return;
    const nb = S.neighborhoods.find((n) => n.id == f.neighborhood_id.value);
    const city = S.settings.store_city || 'São Leopoldo, RS';
    if (!f.street.value.trim()) return pinMsg('Digite a rua primeiro.');
    pinMsg('Buscando no mapa…');
    const tries = [[f.street.value, f.number.value, nb && nb.name, city], [f.street.value, nb && nb.name, city], [f.street.value, city]];
    for (const t of tries) {
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(t.filter(Boolean).join(', ')));
        const j = await r.json();
        if (j[0]) return showPin(+j[0].lat, +j[0].lon);
      } catch {}
    }
    const s = S.settings;
    if (s.store_lat) { await showPin(+s.store_lat, +s.store_lng); pinMsg('Não achamos o endereço exato. Toque no mapa no local da sua casa.'); }
    else pinMsg('Endereço não encontrado. Use “Usar minha localização”.');
  }
  function useGps() {
    if (!navigator.geolocation) return pinMsg('Seu aparelho não permite localização.');
    pinMsg('Pegando sua localização…');
    navigator.geolocation.getCurrentPosition((p) => showPin(p.coords.latitude, p.coords.longitude), () => pinMsg('Não foi possível pegar a localização. Use a busca pelo endereço.'), { enableHighAccuracy: true, timeout: 10000 });
  }

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

  function renderDrawer() { view === 'cart' ? cartView() : checkoutView(); }
  function openDrawer() { view = 'cart'; renderDrawer(); $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); document.body.style.overflow = ''; }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-cat]'); if (!t) return;
    const holder = t.closest('[data-id]'), id = holder && holder.dataset.id;
    if (t.dataset.cat) { cat = t.dataset.cat; renderTabs(); renderGrid(); }
    else if (t.hasAttribute('data-add')) { setQty(id, 1); const c = document.querySelector(`.card[data-id="${id}"]`); c && c.classList.add('added'); toast('Adicionado ao carrinho ✓'); }
    else if (t.hasAttribute('data-inc')) setQty(id, (cart[id] || 0) + 1);
    else if (t.hasAttribute('data-dec')) setQty(id, (cart[id] || 0) - 1);
    else if (t.hasAttribute('data-checkout')) { view = 'checkout'; renderDrawer(); }
    else if (t.hasAttribute('data-back')) { view = 'cart'; renderDrawer(); }
    else if (t.hasAttribute('data-send')) send(t);
    else if (t.hasAttribute('data-findmap')) findOnMap();
    else if (t.hasAttribute('data-gps')) useGps();
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
      $('#status span').textContent = S.open ? `Aberto até ${s.close_time}` : `Fechado · abre ${s.open_time}`;
      for (const id of Object.keys(cart)) { const p = prod(id); if (!p || !p.available) delete cart[id]; else if (cart[id] > p.stock_quantity) cart[id] = p.stock_quantity; }
      save(); renderTabs(); renderGrid(); renderBadge();
    } catch { $('#grid').innerHTML = '<p class="empty">Não foi possível carregar os produtos. Tente novamente.</p>'; }
  }
  load();
})();
