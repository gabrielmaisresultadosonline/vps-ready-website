(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const API = '../api';
  const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const troco = (o) => (+o.change_for > 0 ? `<div class="troco">💵 Troco para ${brl(o.change_for)} → <b>levar ${brl(o.change_for - o.total)}</b></div>` : /dinheiro/i.test(o.payment_method || '') && o.source !== 'manual' ? '<div class="muted">💵 Sem troco</div>' : '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const src = (u) => (!u ? '' : /^(https?:|data:)/.test(u) ? u : '../' + u);
  const dt = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2000); };
  const view = $('#view');
  let charts = [];

  async function api(path, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: opt.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, body: opt.body && !(opt.body instanceof FormData) ? JSON.stringify(opt.body) : opt.body });
    if (r.status === 401) { showLogin(); throw new Error('Sessão expirada'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast('⚠ ' + (j.error || 'Erro')); throw new Error(j.error); }
    return j;
  }
  const STATUS = { aguardando: ['Aguardando confirmação', 'warn'], confirmado: ['Confirmado', 'pink'], preparo: ['Em preparação', 'pink'], saiu: ['Saiu para entrega', 'pink'], entregue: ['Entregue', 'ok'], cancelado: ['Cancelado', 'bad'] };
  const pill = (s) => `<span class="pill ${STATUS[s]?.[1] || ''}">${STATUS[s]?.[0] || s}</span>`;

  // ---------- Modal ----------
  function modal(title, html, onSubmit) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').classList.add('open');
    const f = $('#modalBody form');
    if (f && onSubmit) f.onsubmit = async (e) => { e.preventDefault(); const b = f.querySelector('button[type=submit]'); b && (b.disabled = true); try { await onSubmit(Object.fromEntries(new FormData(f)), f); closeModal(); } catch { b && (b.disabled = false); } };
  }
  const closeModal = () => $('#modal').classList.remove('open');
  document.addEventListener('click', (e) => { if (e.target.matches('[data-mclose]') || e.target.id === 'modal') closeModal(); });

  // Campo de imagem: arquivo, colar (Ctrl+V), URL — com prévia
  const imgField = (name, val, label = 'Imagem') => `<div class="field full img-field"><label>${label}</label>
    <img class="img-prev" src="${esc(src(val))}" ${val ? '' : 'hidden'} alt="">
    <input type="hidden" name="${name}" value="${esc(val || '')}">
    <div class="paste-zone" tabindex="0">📋 Clique aqui e cole (Ctrl+V) uma imagem copiada</div>
    <input type="file" accept="image/*">
    <input type="url" placeholder="…ou cole a URL da imagem" value="${/^https?:/.test(val || '') ? esc(val) : ''}">
    ${val ? '<button type="button" class="btn btn-ghost btn-sm" data-clear>Remover imagem</button>' : ''}</div>`;
  function bindImgFields(root) {
    root.querySelectorAll('.img-field').forEach((w) => {
      const hidden = w.querySelector('input[type=hidden]'), prev = w.querySelector('.img-prev');
      const set = (u) => { hidden.value = u; prev.src = src(u); prev.hidden = !u; };
      const up = async (file) => { const fd = new FormData(); fd.append('file', file); toast('Enviando imagem…'); const r = await api('/admin/upload', { method: 'POST', body: fd }); set(r.url); toast('Imagem carregada ✓'); };
      w.querySelector('input[type=file]').onchange = (e) => e.target.files[0] && up(e.target.files[0]);
      w.querySelector('input[type=url]').oninput = (e) => set(e.target.value.trim());
      w.querySelector('.paste-zone').addEventListener('paste', (e) => { const it = [...e.clipboardData.items].find((i) => i.type.startsWith('image/')); if (it) { e.preventDefault(); up(it.getAsFile()); } else toast('Nenhuma imagem na área de transferência'); });
      const c = w.querySelector('[data-clear]'); c && (c.onclick = () => set(''));
    });
  }

  // ---------- Período ----------
  function periodSelect(id = 'period') {
    return `<div class="field"><label>Período</label><select id="${id}">
      <option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option>
      <option value="month">Este mês</option><option value="lastmonth">Mês anterior</option><option value="12m">Últimos 12 meses</option><option value="year">Ano atual</option><option value="lastyear">Ano anterior</option><option value="custom">Personalizado</option></select></div>
      <div class="field custom-range" hidden><label>De</label><input type="date" id="${id}From"></div><div class="field custom-range" hidden><label>Até</label><input type="date" id="${id}To"></div>`;
  }
  function range(id = 'period') {
    const v = $('#' + id).value, t = new Date(), d = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
    document.querySelectorAll('.custom-range').forEach((e) => (e.hidden = v !== 'custom'));
    switch (v) {
      case 'today': return [iso(t), iso(t)];
      case 'yesterday': return [iso(d(1)), iso(d(1))];
      case '7': return [iso(d(6)), iso(t)];
      case '30': return [iso(d(29)), iso(t)];
      case 'month': return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
      case 'lastmonth': return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
      case '12m': return [iso(new Date(t.getFullYear(), t.getMonth() - 11, 1)), iso(t)];
      case 'year': return [iso(new Date(t.getFullYear(), 0, 1)), iso(t)];
      case 'lastyear': return [iso(new Date(t.getFullYear() - 1, 0, 1)), iso(new Date(t.getFullYear() - 1, 11, 31))];
      default: return [$('#' + id + 'From').value || iso(d(29)), $('#' + id + 'To').value || iso(t)];
    }
  }
  const bindPeriod = (fn, id = 'period') => ['', 'From', 'To'].forEach((s) => ($('#' + id + s).onchange = fn));

  function chart(el, type, labels, datasets, opts = {}) {
    if (!window.Chart) return;
    Chart.defaults.color = '#C8C8D0'; Chart.defaults.borderColor = 'rgba(240,0,121,.12)';
    charts.push(new Chart(el, { type, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: datasets.length > 1 || type === 'doughnut' } }, ...opts } }));
  }
  const PINKS = ['#F00079', '#FF3B9D', '#45001F', '#C8C8D0', '#85818A', '#ff7ab8', '#7a0038', '#ffffff'];

  // ---------- Páginas ----------
  const pages = {
    async dashboard() {
      view.innerHTML = `<div class="toolbar">${periodSelect()}</div><div id="dash"></div>`;
      const load = async () => {
        const [from, to] = range(); charts.forEach((c) => c.destroy()); charts = [];
        const d = await api(`/admin/dashboard?from=${from}&to=${to}`);
        $('#dash').innerHTML = `<div class="kpis">
          <div class="kpi hl"><small>Faturamento bruto</small><b>${brl(d.gross)}</b></div>
          <div class="kpi"><small>Vendas</small><b>${d.sales}</b></div>
          <div class="kpi"><small>Receita produtos</small><b>${brl(d.products_rev)}</b></div>
          <div class="kpi"><small>Receita entrega</small><b>${brl(d.delivery_rev)}</b></div>
          <div class="kpi"><small>Custo mercadoria (CMV)</small><b>${brl(d.cmv)}</b></div>
          <div class="kpi hl"><small>Lucro bruto</small><b>${brl(d.gross_profit)}</b></div>
          <div class="kpi"><small>Despesas operacionais</small><b>${brl(d.expenses)}</b></div>
          <div class="kpi hl"><small>Resultado líquido est.</small><b>${brl(d.net_profit)}</b></div>
          <div class="kpi"><small>Investido em estoque</small><b>${brl(d.investments)}</b></div>
          <div class="kpi"><small>Recebido / Pendente</small><b>${brl(d.received)} <span class="muted">/ ${brl(d.pending_amount)}</span></b></div>
          <div class="kpi"><small>Pedidos pendentes</small><b>${d.pending}</b></div>
          <div class="kpi"><small>Entregues no período</small><b>${d.done}</b></div>
          <div class="kpi"><small>Produtos vendidos</small><b>${d.items_sold}</b></div>
          <div class="kpi"><small>Clientes</small><b>${d.customers}</b></div>
        </div>
        <div class="cols">
          <div class="panel"><h3>Faturamento diário</h3><div class="chart-box"><canvas id="c1"></canvas></div></div>
          <div class="panel"><h3>Últimos 12 meses — faturamento, lucro e despesas</h3><div class="chart-box"><canvas id="c2"></canvas></div></div>
          <div class="panel"><h3>Produtos mais vendidos</h3><div class="chart-box"><canvas id="c3"></canvas></div></div>
          <div class="panel"><h3>Categorias mais vendidas</h3><div class="chart-box"><canvas id="c4"></canvas></div></div>
          <div class="panel"><h3>⚠ Produtos esgotados</h3>${d.low_stock.length ? d.low_stock.map((p) => `<div class="row" style="padding:6px 0"><span>${esc(p.name)}</span>${p.stock_quantity == 0 ? '<span class="pill bad">ESGOTADO</span>' : ''}</div>`).join('') : '<p class="muted">Tudo certo ✓</p>'}</div>
          <div class="panel"><h3>Caixa no período</h3><div class="chart-box"><canvas id="c5"></canvas></div></div>
        </div>`;
        const go = () => {
          chart($('#c1'), 'line', d.daily.map((x) => new Date(x.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })), [{ label: 'Faturamento', data: d.daily.map((x) => +x.total), borderColor: '#F00079', backgroundColor: 'rgba(240,0,121,.2)', fill: true, tension: .35 }]);
          chart($('#c2'), 'bar', d.monthly.map((x) => x.month), [
            { label: 'Faturamento', data: d.monthly.map((x) => +x.revenue), backgroundColor: '#F00079' },
            { label: 'Lucro bruto', data: d.monthly.map((x) => +x.gross_profit), backgroundColor: '#FF3B9D' },
            { label: 'Despesas', data: d.monthly.map((x) => +x.expenses), backgroundColor: '#45001F' }]);
          chart($('#c3'), 'bar', d.top_products.map((x) => x.name), [{ label: 'Qtd', data: d.top_products.map((x) => +x.qty), backgroundColor: '#FF3B9D' }], { indexAxis: 'y' });
          chart($('#c4'), 'doughnut', d.categories.map((x) => x.name), [{ data: d.categories.map((x) => +x.total), backgroundColor: PINKS, borderWidth: 0 }]);
          chart($('#c5'), 'bar', ['Entradas', 'Saídas'], [{ label: 'R$', data: [+d.cash_in, +d.cash_out], backgroundColor: ['#22c55e', '#F00079'] }]);
        };
        window.Chart ? go() : window.addEventListener('load', go, { once: true });
      };
      bindPeriod(load); load();
    },


    async aovivo() {
      view.innerHTML = `<div class="live-top"><span class="live-dot"></span><b>AO VIVO</b><span class="muted" id="liveInfo">atualiza sozinho a cada 8 segundos</span><span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" id="soundBtn">${soundOn ? '🔔 Som ligado' : '🔕 Ativar som'}</button></div>
        <div id="liveList" class="live-feed"></div>`;
      $('#soundBtn').onclick = () => { soundOn = !soundOn; localStorage.setItem('nsd_sound', soundOn ? '1' : '0'); if (soundOn) ding(); $('#soundBtn').textContent = soundOn ? '🔔 Som ligado' : '🔕 Ativar som'; };
      const mins = (d) => Math.max(0, Math.round((Date.now() - new Date(d)) / 60000));
      const NEXT = { aguardando: ['preparo', '👨‍🍳 Em preparação'], confirmado: ['preparo', '👨‍🍳 Em preparação'], preparo: ['saiu', '🛵 Pedido a caminho'], saiu: ['entregue', '✅ Entregue'] };
      const load = async () => {
        if (!document.getElementById('liveList')) return;
        const d = await api('/admin/orders/live');
        const rank = (o) => ({ aguardando: 0, confirmado: 1, preparo: 1, saiu: 2, entregue: 3, cancelado: 4 }[o.status] ?? 5);
        d.orders.sort((x, y) => rank(x) - rank(y) || new Date(y.created_at) - new Date(x.created_at));
        const seenBefore = window._liveSeen || new Set(); window._liveSeen = new Set(d.orders.map((o) => o.id));
        const active = d.orders.filter((o) => !['entregue', 'cancelado'].includes(o.status));
        $('#liveInfo').textContent = `${active.length} em andamento · ${d.orders.filter((o) => o.status === 'entregue').length} entregues hoje`;
        $('#liveList').innerHTML = d.orders.map((o) => `<div class="live-card st-${o.status}${seenBefore.size && !seenBefore.has(o.id) ? ' is-new' : ''}" data-id="${o.id}">
          <div class="row"><b class="ln">#${String(o.order_number).padStart(6, '0')}</b>${pill(o.status)}</div>
          <div><b>${esc(o.customer_name)}</b> <span class="muted">${esc(o.customer_phone || '')}</span></div>
          <div class="muted">${esc(o.neighborhood_name || (o.source === 'manual' ? 'Venda manual' : ''))} ${esc(o.address || '')}</div>
          <div class="items">${o.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join(' · ')}</div>
          ${o.notes ? `<div class="muted">Obs: ${esc(o.notes)}</div>` : ''}
          <div class="row"><b>${brl(o.total)}</b><span class="muted">${esc(o.payment_method || '')} · há ${mins(o.created_at)} min</span></div>
          ${troco(o)}
          ${o.status === 'saiu' && o.out_for_delivery_at ? `<div class="muted">🛵 Saiu há ${mins(o.out_for_delivery_at)} min · baixa automática em ${Math.max(0, d.auto_deliver_minutes - mins(o.out_for_delivery_at))} min</div>` : ''}
          <div class="actions">${NEXT[o.status] ? `<button class="btn btn-primary btn-sm" data-go="${NEXT[o.status][0]}">${NEXT[o.status][1]}</button>` : ''}
            <select class="btn btn-ghost btn-sm" data-set><option value="">Alterar…</option>${Object.entries(STATUS).filter(([k]) => k !== o.status).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
            ${o.customer_phone ? `<a class="btn btn-ghost btn-sm" target="_blank" href="https://wa.me/55${o.customer_phone.replace(/^55/, '')}">WhatsApp</a>` : ''}
            <button class="btn btn-ghost btn-sm" data-del>Excluir</button></div></div>`).join('') || '<p class="muted">Nenhum pedido hoje ainda.</p>';
      };
      const setSt = async (id, st) => {
        if (st === 'cancelado' && !confirm('Cancelar pedido? Se já confirmado, o estoque volta.')) return;
        await api('/admin/orders/' + id, { method: 'PUT', body: { status: st } }); toast('Status atualizado ✓'); load();
      };
      $('#liveList').onclick = async (e) => {
        const card = e.target.closest('[data-id]'); if (!card) return; const id = card.dataset.id;
        if (e.target.dataset.go) setSt(id, e.target.dataset.go);
        if (e.target.hasAttribute('data-del') && confirm('Excluir este pedido de vez? O estoque volta e o lançamento financeiro some.')) { await api('/admin/orders/' + id, { method: 'DELETE' }); toast('Pedido excluído'); load(); }
      };
      $('#liveList').onchange = (e) => { const card = e.target.closest('[data-id]'); if (e.target.hasAttribute('data-set') && e.target.value) setSt(card.dataset.id, e.target.value); };
      liveRefresh = load; await load();
    },

    async pedidos() {
      view.innerHTML = `<div class="toolbar"><div class="field"><label>Status</label><select id="st"><option value="">Todos</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div>${periodSelect()}<a class="btn btn-primary" href="#venda">+ Venda manual</a></div><div id="list"></div>`;
      const load = async () => {
        const [from, to] = range(); const rows = await api(`/admin/orders?status=${$('#st').value}&from=${from}&to=${to}`);
        $('#list').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Valores</th><th>Status</th><th>Pagamento</th><th>Ações</th></tr></thead><tbody>
          ${rows.map((o) => `<tr><td><b>#${String(o.order_number).padStart(6, '0')}</b><br><span class="muted">${dt(o.created_at)}<br>${o.source === 'manual' ? 'Manual' : 'Site'}</span></td>
            <td>${esc(o.customer_name)}<br><span class="muted">${esc(o.customer_phone || '')}<br>${esc(o.neighborhood_name || '')} ${esc(o.address || '')}</span></td>
            <td>${o.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join('<br>')}</td>
            <td>Produtos ${brl(o.subtotal)}<br>Entrega ${brl(o.delivery_fee)}<br><b>Total ${brl(o.total)}</b><br><span class="muted">Custo ${brl(o.cost)} · Lucro ${brl(o.subtotal - o.cost)}</span></td>
            <td>${pill(o.status)}</td><td><span class="pill ${o.payment_status === 'pago' ? 'ok' : ''}">${o.payment_status}</span><br><span class="muted">${esc(o.payment_method || '')}</span>${troco(o)}</td>
            <td><div class="actions">
              <select data-status="${o.id}" class="btn btn-ghost btn-sm">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
              ${o.status !== 'cancelado' ? `<button class="btn btn-ghost btn-sm" data-pay="${o.id}" data-cur="${o.payment_status}" data-st="${o.status}">${o.payment_status === 'pago' ? 'Marcar pendente' : 'Marcar pago'}</button>` : ''}
              ${o.customer_phone ? `<a class="btn btn-ghost btn-sm" target="_blank" href="https://wa.me/55${o.customer_phone.replace(/^55/, '')}">WhatsApp</a>` : ''}
              <button class="btn btn-ghost btn-sm" data-del="${o.id}">Excluir</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Nenhum pedido.</td></tr>'}
          </tbody></table></div>`;
        $('#list').querySelectorAll('[data-status]').forEach((s) => (s.onchange = async () => {
          if (s.value === 'cancelado' && !confirm('Cancelar pedido? Se já confirmado, o estoque será estornado.')) return load();
          await api('/admin/orders/' + s.dataset.status, { method: 'PUT', body: { status: s.value } }); toast('Status atualizado ✓'); load();
        }));
        $('#list').querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
          if (!confirm('Excluir este pedido de vez? O estoque volta e o lançamento financeiro some.')) return;
          await api('/admin/orders/' + b.dataset.del, { method: 'DELETE' }); toast('Pedido excluído'); load();
        }));
        $('#list').querySelectorAll('[data-pay]').forEach((b) => (b.onclick = async () => {
          await api('/admin/orders/' + b.dataset.pay, { method: 'PUT', body: { status: b.dataset.st, payment_status: b.dataset.cur === 'pago' ? 'pendente' : 'pago' } }); toast('Pagamento atualizado ✓'); load();
        }));
      };
      $('#st').onchange = load; bindPeriod(load); load();
    },

    async venda() {
      const [prods, s] = await Promise.all([api('/admin/products'), api('/admin/settings')]);
      const act = prods.filter((p) => p.status !== 'rascunho');
      const line = () => `<div class="form vline" style="grid-template-columns:2fr 1fr 1fr auto;align-items:end">
        <div class="field"><label>Produto</label><select name="product_id">${act.map((p) => `<option value="${p.id}" data-price="${+p.promo_price || +p.sale_price}">${esc(p.name)} (${p.stock_quantity} em estoque)</option>`).join('')}</select></div>
        <div class="field"><label>Qtd</label><input name="quantity" type="number" min="1" value="1"></div>
        <div class="field"><label>Valor un.</label><input name="unit_price" type="number" step="0.01"></div>
        <button type="button" class="btn btn-ghost btn-sm" data-rm>✕</button></div>`;
      view.innerHTML = `<div class="panel"><h3>Registrar venda presencial ou feita pelo WhatsApp</h3><form id="vf" style="display:flex;flex-direction:column;gap:12px">
        <div id="lines">${line()}</div><button type="button" class="btn btn-ghost" id="addLine">+ Adicionar produto</button>
        <div class="form"><div class="field"><label>Cliente (opcional)</label><input name="customer_name"></div><div class="field"><label>Telefone</label><input name="customer_phone"></div>
        <div class="field"><label>Pagamento</label><select name="payment_method">${(s.payment_methods || 'Pix,Dinheiro').split(',').map((x) => `<option>${esc(x.trim())}</option>`).join('')}</select></div>
        <div class="field"><label>Taxa de entrega</label><input name="delivery_fee" type="number" step="0.01" value="0"></div>
        <div class="field"><label>Recebido?</label><select name="paid"><option value="1">Sim, já recebido</option><option value="0">Não, pendente</option></select></div>
        <div class="field"><label>Observação</label><input name="notes"></div></div>
        <div class="row total"><span>TOTAL</span><span id="vtot">R$ 0,00</span></div>
        <button class="btn btn-primary">CONFIRMAR VENDA</button></form></div>`;
      const fill = () => { document.querySelectorAll('.vline').forEach((l) => { const sel = l.querySelector('select'), up = l.querySelector('[name=unit_price]'); if (!up.dataset.touched) up.value = sel.selectedOptions[0]?.dataset.price || 0; }); let t = +$('#vf').delivery_fee.value || 0; document.querySelectorAll('.vline').forEach((l) => (t += (+l.querySelector('[name=quantity]').value || 0) * (+l.querySelector('[name=unit_price]').value || 0))); $('#vtot').textContent = brl(t); };
      $('#vf').addEventListener('input', (e) => { if (e.target.name === 'unit_price') e.target.dataset.touched = 1; if (e.target.tagName === 'SELECT') { const up = e.target.closest('.vline')?.querySelector('[name=unit_price]'); up && delete up.dataset.touched; } fill(); });
      $('#vf').addEventListener('change', fill);
      $('#addLine').onclick = () => { $('#lines').insertAdjacentHTML('beforeend', line()); fill(); };
      $('#lines').onclick = (e) => { if (e.target.matches('[data-rm]') && document.querySelectorAll('.vline').length > 1) { e.target.closest('.vline').remove(); fill(); } };
      fill();
      $('#vf').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target;
        const items = [...document.querySelectorAll('.vline')].map((l) => ({ product_id: l.querySelector('select').value, quantity: l.querySelector('[name=quantity]').value, unit_price: l.querySelector('[name=unit_price]').value }));
        await api('/admin/orders/manual', { method: 'POST', body: { items, customer_name: f.customer_name.value, customer_phone: f.customer_phone.value, payment_method: f.payment_method.value, delivery_fee: f.delivery_fee.value, paid: f.paid.value === '1', notes: f.notes.value } });
        toast('Venda registrada e estoque baixado ✓'); pages.venda();
      };
    },

    async baixa() {
      view.innerHTML = `<div class="toolbar"><input class="search" id="q" placeholder="Buscar produto…"></div><div class="quick" id="qk"></div><div class="panel"><h3>Últimas movimentações</h3><div id="mv"></div></div>`;
      let prods = [];
      const render = () => {
        const t = $('#q').value.toLowerCase();
        $('#qk').innerHTML = prods.filter((p) => p.status !== 'rascunho' && p.name.toLowerCase().includes(t)).map((p) => `<div class="quick-card" data-id="${p.id}">
          <div class="top"><b>${esc(p.name)}</b><span class="stock">${p.stock_quantity}</span></div>
          ${p.stock_quantity == 0 ? '<span class="pill bad">PRODUTO ESGOTADO</span>' : false ? '<span class="pill warn">ESTOQUE BAIXO</span>' : ''}
          <div class="btns">${[1, 2, 5, 10].map((n) => `<button class="btn btn-primary btn-sm" data-n="${n}" ${p.stock_quantity < n ? 'disabled' : ''}>-${n}</button>`).join('')}</div>
          <div class="manual"><input type="number" min="1" placeholder="Qtd"><button class="btn btn-ghost btn-sm" data-manual>DAR BAIXA</button></div></div>`).join('');
      };
      const mv = async () => {
        const m = await api('/admin/stock/movements');
        $('#mv').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Por</th><th></th></tr></thead><tbody>${m.slice(0, 40).map((x) => `<tr><td>${dt(x.created_at)}</td><td>${esc(x.product_name)}</td><td>${x.type}${x.reverted ? ' <span class="pill bad">estornado</span>' : ''}</td><td>${x.quantity > 0 ? '+' : ''}${x.quantity}</td><td>${esc(x.user_name || '')}</td><td>${['saida', 'entrada', 'ajuste'].includes(x.type) && !x.reverted ? `<button class="btn btn-ghost btn-sm" data-revert="${x.id}">Desfazer</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      };
      const load = async () => { prods = await api('/admin/products'); render(); mv(); };
      $('#q').oninput = render;
      view.onclick = async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const card = b.closest('.quick-card');
        if (b.dataset.n || b.hasAttribute('data-manual')) {
          const n = b.dataset.n || card.querySelector('input').value; if (!(+n > 0)) return toast('Informe a quantidade');
          b.disabled = true; await api('/admin/stock/out', { method: 'POST', body: { product_id: card.dataset.id, quantity: +n } }).finally(() => (b.disabled = false)); toast(`Baixa de ${n} registrada ✓`); load();
        } else if (b.dataset.revert && confirm('Desfazer esta movimentação (estorno)?')) { await api('/admin/stock/revert/' + b.dataset.revert, { method: 'POST' }); toast('Estorno registrado ✓'); load(); }
      };
      load();
    },

    async estoque() {
      view.innerHTML = `<div class="toolbar"><div class="field"><label>Filtro</label><select id="f"><option value="">Todos</option><option value="zero">Sem estoque</option><option value="ok">Estoque disponível</option></select></div><input class="search" id="q" placeholder="Buscar…"></div><div id="sum" class="kpis"></div><div id="list"></div>`;
      let prods = [];
      const render = () => {
        const f = $('#f').value, t = $('#q').value.toLowerCase();
        const list = prods.filter((p) => p.status !== 'rascunho' && p.name.toLowerCase().includes(t) && (!f || (f === 'zero' ? p.stock_quantity == 0 : p.stock_quantity > 0)));
        const cost = prods.reduce((a, p) => a + p.stock_quantity * p.current_cost, 0), pot = prods.reduce((a, p) => a + p.stock_quantity * p.sale_price, 0);
        $('#sum').innerHTML = `<div class="kpi"><small>Valor em estoque (custo)</small><b>${brl(cost)}</b></div><div class="kpi hl"><small>Valor potencial de venda</small><b>${brl(pot)}</b></div><div class="kpi"><small>Itens esgotados</small><b>${prods.filter((p) => p.stock_quantity == 0 && p.status !== 'rascunho').length}</b></div>`;
        $('#list').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Estoque</th><th>Custo un.</th><th>Preço</th><th>Potencial</th><th>Comprado / Saídas</th><th>Ações</th></tr></thead><tbody>
          ${list.map((p) => `<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.category_name || '')}</span></td>
            <td><b>${p.stock_quantity}</b> ${p.stock_quantity == 0 ? '<span class="pill bad">ESGOTADO</span>' : false ? '<span class="pill warn">BAIXO</span>' : ''}</td>
            <td>${brl(p.current_cost)}</td><td>${brl(p.sale_price)}</td><td>${brl(p.stock_quantity * p.sale_price)}</td><td>${p.total_bought} / ${p.total_out}</td>
            <td><div class="actions"><button class="btn btn-primary btn-sm" data-entry="${p.id}">+ Entrada</button><button class="btn btn-ghost btn-sm" data-hist="${p.id}">Histórico</button><button class="btn btn-ghost btn-sm" style="color:#fca5a5;border-color:#ef4444" data-sdel="${p.id}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>`;
      };
      const load = async () => { prods = await api('/admin/products'); render(); };
      $('#f').onchange = render; $('#q').oninput = render;
      view.onclick = async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const p = prods.find((x) => x.id == (b.dataset.entry || b.dataset.hist || b.dataset.sdel));
        if (b.dataset.sdel) { if (!confirm(`Excluir "${p.name}"? Ele some da loja e do painel. O histórico de vendas, estoque e financeiro continua guardado.`)) return; await api('/admin/products/' + p.id, { method: 'DELETE' }); toast('Produto excluído ✓'); return load(); }
        if (b.dataset.entry) modal('Entrada: ' + p.name, `<form class="form">
          <div class="field"><label>Quantidade comprada</label><input name="quantity" type="number" min="1" required></div>
          <div class="field"><label>Custo total (R$)</label><input name="total_cost" type="number" step="0.01" min="0" required></div>
          <div class="field"><label>Data</label><input name="date" type="date" value="${iso(new Date())}"></div>
          <div class="field"><label>Fornecedor</label><input name="supplier"></div>
          <div class="field"><label>Forma de pagamento</label><input name="payment_method" placeholder="Pix, dinheiro…"></div>
          <div class="field"><label>Observação</label><input name="notes"></div>
          <p class="muted field full">O custo unitário é calculado automaticamente e a compra é lançada uma única vez no financeiro como investimento em estoque.</p>
          <button class="btn btn-primary field full" type="submit">REGISTRAR ENTRADA</button></form>`,
          async (d) => { await api('/admin/stock/entry', { method: 'POST', body: { ...d, product_id: p.id } }); toast('Entrada registrada ✓'); load(); });
        if (b.dataset.hist) { const m = await api('/admin/stock/movements?product_id=' + p.id); modal('Histórico: ' + p.name, `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Qtd</th><th>Custo</th><th>Obs.</th><th>Por</th></tr></thead><tbody>${m.map((x) => `<tr><td>${dt(x.created_at)}</td><td>${x.type}</td><td>${x.quantity}</td><td>${x.unit_cost ? brl(x.unit_cost) : ''}</td><td>${esc(x.supplier || x.notes || '')}</td><td>${esc(x.user_name || '')}</td></tr>`).join('')}</tbody></table></div>`); }
      };
      load();
    },

    async produtos() {
      const [prods, cats] = await Promise.all([api('/admin/products'), api('/admin/categories')]);
      view.innerHTML = `<div class="toolbar"><button class="btn btn-primary" id="new">+ Novo produto</button><input class="search" id="q" placeholder="Buscar…"></div><div id="list"></div>`;
      const render = () => {
        const t = $('#q').value.toLowerCase();
        $('#list').innerHTML = `<div class="table-wrap"><table><thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th></th></tr></thead><tbody>
        ${prods.filter((p) => p.name.toLowerCase().includes(t)).map((p) => `<tr><td>${p.image ? `<img src="${esc(src(p.image))}" style="width:48px;height:48px;object-fit:cover;border-radius:8px">` : ''}</td>
          <td><b>${esc(p.name)}</b>${p.featured ? ' <span class="pill pink">destaque</span>' : ''}<br><span class="muted">${esc(p.description || '')}</span></td><td>${esc(p.category_name || '')}</td>
          <td>${brl(p.sale_price)}${+p.promo_price ? `<br><span class="pill pink">promo ${brl(p.promo_price)}</span>` : ''}</td><td>${p.stock_quantity}${p.stock_quantity == 0 ? ' <span class="pill bad">ESGOTADO</span>' : false ? ' <span class="pill warn">BAIXO</span>' : ''}</td>
          <td><span class="pill ${p.status === 'ativo' ? 'ok' : p.status === 'rascunho' ? '' : 'warn'}">${p.status}</span></td>
          <td><button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button> <button class="btn btn-ghost btn-sm" style="color:#fca5a5;border-color:#ef4444" data-del="${p.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>`;
      };
      const form = (p = {}) => {
        modal(p.id ? 'Editar produto' : 'Novo produto', `<form class="form">
          <div class="field full"><label>Nome *</label><input name="name" required value="${esc(p.name || '')}"></div>
          <div class="field full"><label>Descrição</label><textarea name="description" rows="2">${esc(p.description || '')}</textarea></div>
          <div class="field"><label>Categoria</label><select name="category_id">${cats.map((c) => `<option value="${c.id}" ${c.id == p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Unidade</label><input name="unit" value="${esc(p.unit || 'un')}"></div>
          <div class="field"><label>Preço de venda *</label><input name="sale_price" type="number" step="0.01" required value="${p.sale_price ?? ''}"></div>
          <div class="field"><label>Preço promocional</label><input name="promo_price" type="number" step="0.01" value="${p.promo_price ?? ''}"></div>
          <div class="field"><label>Custo unitário</label><input name="current_cost" type="number" step="0.01" value="${p.current_cost ?? ''}"></div>
          ${p.id ? '' : '<div class="field"><label>Estoque inicial</label><input name="stock_quantity" type="number" min="0" value="0"></div>'}
          <div class="field"><label>Status</label><select name="status">${['ativo', 'indisponivel', 'rascunho'].map((s) => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Destaque na home</label><select name="featured"><option value="">Não</option><option value="1" ${p.featured ? 'selected' : ''}>Sim</option></select></div>
          <div class="field"><label>Ordem de exibição</label><input name="sort_order" type="number" value="${p.sort_order ?? 0}"></div>
          ${imgField('image', p.image)}
          <button class="btn btn-primary field full" type="submit">SALVAR</button></form>`,
          async (d) => { d.featured = !!d.featured; await api('/admin/products' + (p.id ? '/' + p.id : ''), { method: p.id ? 'PUT' : 'POST', body: d }); toast('Produto salvo ✓'); pages.produtos(); });
        bindImgFields($('#modalBody'));
      };
      $('#new').onclick = () => form(); $('#q').oninput = render;
      view.onclick = async (e) => {
        const d = e.target.closest('[data-del]');
        if (d) { const p = prods.find((x) => x.id == d.dataset.del); if (!confirm(`Excluir "${p.name}"? Ele some da loja e do painel. O histórico de vendas, estoque e financeiro continua guardado.`)) return; await api('/admin/products/' + p.id, { method: 'DELETE' }); toast('Produto excluído ✓'); return pages.produtos(); }
        const b = e.target.closest('[data-edit]'); b && form(prods.find((p) => p.id == b.dataset.edit)); };
      render();
    },

    async categorias() {
      const cats = await api('/admin/categories');
      view.innerHTML = `<div class="toolbar"><button class="btn btn-primary" id="new">+ Nova categoria</button></div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Ordem</th><th>Status</th><th></th></tr></thead><tbody>${cats.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.sort_order}</td><td>${c.active ? '<span class="pill ok">ativa</span>' : '<span class="pill">inativa</span>'}</td><td><button class="btn btn-ghost btn-sm" data-edit="${c.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>`;
      const form = (c = {}) => { modal(c.id ? 'Editar categoria' : 'Nova categoria', `<form class="form"><div class="field full"><label>Nome</label><input name="name" required value="${esc(c.name || '')}"></div><div class="field"><label>Ordem</label><input name="sort_order" type="number" value="${c.sort_order ?? 0}"></div><div class="field"><label>Status</label><select name="active"><option value="1">Ativa</option><option value="" ${c.active === false ? 'selected' : ''}>Inativa</option></select></div><button class="btn btn-primary field full" type="submit">SALVAR</button></form>`,
        async (d) => { d.active = !!d.active; await api('/admin/categories' + (c.id ? '/' + c.id : ''), { method: c.id ? 'PUT' : 'POST', body: d }); pages.categorias(); }); };
      $('#new').onclick = () => form(); view.onclick = (e) => { const b = e.target.closest('[data-edit]'); b && form(cats.find((c) => c.id == b.dataset.edit)); };
    },

    async bairros() {
      const nbs = await api('/admin/neighborhoods'), s = await api('/admin/settings');
      view.innerHTML = `<div class="panel"><h3>Regras de entrega</h3><form id="rules" class="toolbar"><div class="field"><label>Pedido mínimo (R$)</label><input name="min_order" type="number" step="0.01" value="${s.min_order || 0}"></div><div class="field"><label>Entrega grátis acima de (R$, 0 = desativado)</label><input name="free_delivery_above" type="number" step="0.01" value="${s.free_delivery_above || 0}"></div><button class="btn btn-ghost">Salvar regras</button></form></div>
        <div class="toolbar"><button class="btn btn-primary" id="new">+ Novo bairro</button></div>
        <div class="table-wrap"><table><thead><tr><th>Bairro</th><th>Taxa</th><th>Tempo</th><th>Status</th><th>Obs.</th><th></th></tr></thead><tbody>${nbs.map((n) => `<tr><td><b>${esc(n.name)}</b></td><td>${brl(n.delivery_fee)}</td><td>${n.estimated_minutes ? n.estimated_minutes + ' min' : '-'}</td><td>${n.active ? '<span class="pill ok">ativo</span>' : '<span class="pill">inativo</span>'}</td><td class="muted">${esc(n.notes || '')}</td><td><button class="btn btn-ghost btn-sm" data-edit="${n.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Cadastre os bairros atendidos.</td></tr>'}</tbody></table></div>`;
      $('#rules').onsubmit = async (e) => { e.preventDefault(); await api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Regras salvas ✓'); };
      const form = (n = {}) => modal(n.id ? 'Editar bairro' : 'Novo bairro', `<form class="form"><div class="field full"><label>Nome</label><input name="name" required value="${esc(n.name || '')}"></div><div class="field"><label>Taxa (R$)</label><input name="delivery_fee" type="number" step="0.01" required value="${n.delivery_fee ?? ''}"></div><div class="field"><label>Tempo estimado (min)</label><input name="estimated_minutes" type="number" value="${n.estimated_minutes ?? ''}"></div><div class="field"><label>Status</label><select name="active"><option value="1">Ativo</option><option value="" ${n.active === false ? 'selected' : ''}>Inativo</option></select></div><div class="field"><label>Observações internas</label><input name="notes" value="${esc(n.notes || '')}"></div><button class="btn btn-primary field full" type="submit">SALVAR</button></form>`,
        async (d) => { d.active = !!d.active; await api('/admin/neighborhoods' + (n.id ? '/' + n.id : ''), { method: n.id ? 'PUT' : 'POST', body: d }); pages.bairros(); });
      $('#new').onclick = () => form(); view.onclick = (e) => { const b = e.target.closest('[data-edit]'); b && form(nbs.find((x) => x.id == b.dataset.edit)); };
    },

    async financeiro() {
      view.innerHTML = `<div class="toolbar">${periodSelect()}<button class="btn btn-primary" id="new">+ Lançamento</button></div><div id="fin"></div>`;
      const load = async () => {
        const [from, to] = range(); const [rows, d] = await Promise.all([api(`/admin/finance?from=${from}&to=${to}`), api(`/admin/dashboard?from=${from}&to=${to}`)]);
        $('#fin').innerHTML = `<div class="kpis">
          <div class="kpi"><small>Faturamento bruto</small><b>${brl(d.gross)}</b></div><div class="kpi"><small>Receita produtos</small><b>${brl(d.products_rev)}</b></div><div class="kpi"><small>Receita entrega</small><b>${brl(d.delivery_rev)}</b></div>
          <div class="kpi"><small>CMV (custo histórico)</small><b>${brl(d.cmv)}</b></div><div class="kpi hl"><small>Lucro bruto</small><b>${brl(d.gross_profit)}</b></div><div class="kpi"><small>Despesas operacionais</small><b>${brl(d.expenses)}</b></div>
          <div class="kpi hl"><small>Resultado líquido est.</small><b>${brl(d.net_profit)}</b></div><div class="kpi"><small>Entrou no caixa</small><b>${brl(d.cash_in)}</b></div><div class="kpi"><small>Saiu do caixa</small><b>${brl(d.cash_out)}</b></div>
          <div class="kpi hl"><small>Saldo de caixa</small><b>${brl(d.cash_in - d.cash_out)}</b></div><div class="kpi"><small>Valores pendentes</small><b>${brl(d.pending_amount)}</b></div></div>
          <p class="muted">Compras de estoque saem do caixa, mas não são descontadas do lucro: o lucro usa o custo dos produtos efetivamente vendidos.</p>
          <div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Pagamento</th><th></th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>${new Date(r.entry_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td><td><span class="pill ${r.type === 'entrada' ? 'ok' : 'bad'}">${r.type}</span></td><td>${esc(r.category)}</td><td>${esc(r.description || '')}<br><span class="muted">${esc(r.notes || '')}</span></td><td><b>${r.type === 'saida' ? '-' : ''}${brl(r.amount)}</b></td><td>${esc(r.payment_method || '')}</td><td>${!r.order_id && !r.stock_movement_id ? `<button class="btn btn-ghost btn-sm" data-del="${r.id}">Excluir</button>` : '<span class="muted">auto</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Sem lançamentos.</td></tr>'}</tbody></table></div>`;
      };
      const CATS = { entrada: ['Outras receitas', 'Taxa de entrega avulsa'], saida: ['Despesas operacionais', 'Combustível', 'Entregadores', 'Embalagens', 'Outros investimentos', 'Aluguel', 'Marketing'] };
      $('#new').onclick = () => {
        modal('Novo lançamento', `<form class="form"><div class="field"><label>Tipo</label><select name="type" id="ftype"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></div>
          <div class="field"><label>Categoria</label><select name="category" id="fcat"></select></div><div class="field full"><label>Descrição</label><input name="description" required></div>
          <div class="field"><label>Valor (R$)</label><input name="amount" type="number" step="0.01" min="0.01" required></div><div class="field"><label>Data</label><input name="entry_date" type="date" value="${iso(new Date())}"></div>
          <div class="field"><label>Forma de pagamento</label><input name="payment_method"></div><div class="field"><label>Observação / comprovante</label><input name="notes"></div>
          <button class="btn btn-primary field full" type="submit">SALVAR</button></form>`, async (d) => { await api('/admin/finance', { method: 'POST', body: d }); toast('Lançamento salvo ✓'); load(); });
        const upd = () => ($('#fcat').innerHTML = CATS[$('#ftype').value].map((c) => `<option>${c}</option>`).join('')); $('#ftype').onchange = upd; upd();
      };
      view.onclick = async (e) => { const b = e.target.closest('[data-del]'); if (b && confirm('Excluir lançamento?')) { await api('/admin/finance/' + b.dataset.del, { method: 'DELETE' }); load(); } };
      bindPeriod(load); load();
    },

    async clientes() {
      const rows = await api('/admin/customers');
      view.innerHTML = `<div class="toolbar"><input class="search" id="q" placeholder="Nome, telefone ou bairro…"><div class="field"><label>Filtro</label><select id="f"><option value="">Todos</option><option value="new">Novos (1 pedido)</option><option value="rec">Recorrentes</option><option value="7">Compraram nos últimos 7 dias</option><option value="30">Compraram nos últimos 30 dias</option><option value="inactive">Inativos (60+ dias)</option></select></div></div><div id="list"></div>`;
      const render = () => {
        const t = $('#q').value.toLowerCase(), f = $('#f').value, days = (c) => c.last_order_at ? (Date.now() - new Date(c.last_order_at)) / 864e5 : 9999;
        const list = rows.filter((c) => (c.name + c.phone + (c.neighborhood || '')).toLowerCase().includes(t) && (!f || (f === 'new' ? c.orders_count == 1 : f === 'rec' ? c.orders_count > 1 : f === 'inactive' ? days(c) > 60 : days(c) <= +f)));
        $('#list').innerHTML = `<p class="muted">${list.length} cliente(s)</p><div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Endereço</th><th>Pedidos</th><th>Total gasto</th><th>Ticket médio</th><th>Última compra</th><th></th></tr></thead><tbody>
          ${list.map((c) => `<tr><td><b>${esc(c.name)}</b><br><span class="muted">${esc(c.phone)}</span></td><td>${esc(c.neighborhood || '')}<br><span class="muted">${esc([c.street, c.number].filter(Boolean).join(', '))}</span></td><td>${c.orders_count}</td><td>${brl(c.total_spent)}</td><td>${brl(c.orders_count ? c.total_spent / c.orders_count : 0)}</td><td>${c.last_order_at ? dt(c.last_order_at) : '-'}<br><span class="muted">desde ${new Date(c.created_at).toLocaleDateString('pt-BR')}</span></td>
          <td><div class="actions"><button class="btn btn-ghost btn-sm" data-hist="${c.id}">Histórico</button><a class="btn btn-ghost btn-sm" target="_blank" href="https://wa.me/55${c.phone.replace(/^55/, '')}">WhatsApp</a></div></td></tr>`).join('')}</tbody></table></div>`;
      };
      $('#q').oninput = render; $('#f').onchange = render;
      view.onclick = async (e) => { const b = e.target.closest('[data-hist]'); if (!b) return; const o = await api(`/admin/customers/${b.dataset.hist}/orders`); modal('Histórico de compras', o.map((x) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>#${String(x.order_number).padStart(6, '0')} · ${dt(x.created_at)}</span><span>${pill(x.status)} <b>${brl(x.total)}</b></span></div>`).join('') || '<p class="muted">Sem pedidos.</p>'); };
      render();
    },

    async tutorial() {
      const sec = (icon, title, href, body) => `<details class="tut" ${href === 'dashboard' ? 'open' : ''}><summary><span>${icon}</span>${title}</summary><div class="tut-body">${body}${href ? `<a class="btn btn-ghost btn-sm" href="#${href}">Abrir ${title} →</a>` : ''}</div></details>`;
      view.innerHTML = `<div class="panel tut-intro"><h3>📘 Como usar o painel</h3>
        <p>Aqui está tudo que você pode fazer no painel da No Silva Drinks. Toque em cada item para abrir a explicação. No celular, abra o menu pelo botão ☰ no topo.</p>
        <p class="muted"><b>Primeiros passos sugeridos:</b> 1) Configurações (WhatsApp, endereço, horário) → 2) Zerar os dados de exemplo → 3) Categorias → 4) Produtos → 5) Estoque (entrada de mercadoria) → 6) Bairros e taxas → 7) Deixe “Pedidos ao vivo” aberto.</p></div>
      <div class="tut-list">
      ${sec('📊', 'Dashboard', 'dashboard', `<p>Resumo do negócio no período escolhido (hoje, 7 dias, 30 dias, mês, etc.).</p><ul>
        <li><b>Faturamento bruto</b>: total vendido (produtos + entregas).</li><li><b>Custo da mercadoria (CMV)</b> e <b>Lucro bruto</b>: quanto custou o que foi vendido e quanto sobrou.</li>
        <li><b>Despesas</b> e <b>Resultado líquido</b>: lucro menos as saídas do financeiro.</li><li><b>Recebido / Pendente</b>: pedidos pagos e a receber.</li>
        <li>Gráficos de faturamento diário, últimos 12 meses, produtos e categorias mais vendidos, e alerta de <b>produtos esgotados</b>.</li></ul>`)}
      ${sec('🛵', 'Pedidos ao vivo', 'aovivo', `<p>A tela de trabalho do dia. Deixe aberta no computador ou celular.</p><ul>
        <li>Pedidos novos aparecem <b>sozinhos</b> (a cada ~8 segundos), sem recarregar.</li>
        <li>Ao chegar pedido, em <b>qualquer tela do painel</b> abre uma janela no meio da tela com os dados do pedido e toca um <b>som</b> que repete até você clicar em “Ver pedido” ou “Fechar”.</li>
        <li>O botão 🔔/🔕 liga ou desliga o som. Os navegadores só tocam som depois de você clicar uma vez na página.</li>
        <li><b>Lista ao vivo</b>: os pedidos novos entram no topo com destaque piscando; os em andamento ficam primeiro e os entregues/cancelados no fim.</li>
        <li>Botão principal muda o pedido passo a passo: <b>Recebido → Em preparação → A caminho</b>. Quando fica “A caminho”, depois do tempo configurado (padrão 40 min) ele vira <b>Entregue</b> automaticamente.</li>
        <li>“Alterar…” volta ou muda o status, inclusive <b>Cancelar</b>. “Excluir” apaga o pedido e devolve o estoque.</li>
        <li>Pagamento em dinheiro mostra o <b>troco</b>: “Troco para R$ 100 → levar R$ 87,50”.</li></ul>`)}
      ${sec('🧾', 'Pedidos / Vendas', 'pedidos', `<ul><li>Lista completa com filtro por status e período.</li><li>Mostra itens, subtotal, entrega, total, custo, lucro, forma de pagamento e troco.</li>
        <li>Mude o status, marque como <b>pago/pendente</b> (gera a entrada no financeiro), abra o WhatsApp do cliente ou exclua.</li>
        <li>O estoque só é descontado quando o pedido é confirmado (em preparação, a caminho ou entregue). Cancelar devolve o estoque.</li></ul>`)}
      ${sec('➕', 'Venda manual', 'venda', `<p>Para vendas no balcão ou pedidos feitos por telefone. Escolha os produtos e quantidades, cliente (opcional), forma de pagamento e taxa de entrega. Já desconta o estoque e, se marcado como pago, lança no financeiro.</p>`)}
      ${sec('⚡', 'Baixa rápida', 'baixa', `<p>Botões grandes −1, −2, −5, −10 para tirar do estoque na hora (consumo, quebra, brinde). Ideal para usar no celular.</p>`)}
      ${sec('📦', 'Estoque', 'estoque', `<ul><li>Veja quantidade, custo, valor em estoque e itens esgotados.</li>
        <li><b>Entrada de mercadoria</b>: quantidade, custo unitário, fornecedor e forma de pagamento. Atualiza o custo do produto e lança a saída no financeiro.</li>
        <li>Histórico de movimentações com opção de <b>estornar</b> um lançamento errado.</li></ul>`)}
      ${sec('🍾', 'Produtos', 'produtos', `<ul><li>Cadastre nome, descrição, foto (envio ou link), categoria, unidade, preço de venda, <b>preço promocional</b>, custo, e <b>estoque inicial</b>.</li>
        <li>Status: <b>ativo</b> (aparece na loja), <b>indisponível</b> (aparece como esgotado) ou <b>rascunho</b> (escondido).</li>
        <li>Marque <b>destaque</b> para aparecer primeiro. Quando o estoque chega a 0, aparece “ESGOTADO”. O botão <b>Excluir</b> tira o produto da loja e do painel, mas o histórico de vendas e estoque continua guardado; para só esconder, use o status <b>rascunho</b>.</li></ul>`)}
      ${sec('🗂️', 'Categorias', 'categorias', `<p>Crie, renomeie, ordene e desative as abas da loja (ex.: Alcoólicos, Não alcoólicos, Itens variados).</p>`)}
      ${sec('📍', 'Bairros e taxas', 'bairros', `<p>Cadastre cada bairro atendido com a <b>taxa de entrega</b> e o tempo estimado. O cliente escolhe o bairro no pedido e a taxa entra no total. Desative bairros que não atende mais.</p>`)}
      ${sec('💰', 'Financeiro', 'financeiro', `<ul><li>Todas as entradas e saídas: vendas pagas e compras de estoque entram sozinhas (“auto”).</li>
        <li>Lance despesas como aluguel, luz, motoboy, embalagens, com categoria e forma de pagamento.</li><li>Filtre por período e veja saldo.</li></ul>`)}
      ${sec('👥', 'Clientes', 'clientes', `<p>Clientes são salvos automaticamente pelo telefone a cada pedido: nome, endereço, quantidade de pedidos, total gasto e último pedido. Clique para falar no WhatsApp.</p>`)}
      ${sec('⚙️', 'Configurações', 'configuracoes', `<ul><li><b>WhatsApp</b> que recebe os pedidos (com 55 + DDD).</li><li><b>Formas de pagamento</b> (ex.: Pix, Dinheiro, Cartão). Com “Dinheiro”, o cliente informa se precisa de troco e o sistema calcula.</li>
        <li><b>Endereço da loja</b>: usado nos dados da loja. <b>Minutos para baixa automática</b> (padrão 40).</li>
        <li><b>Horário</b> de abertura/fechamento ou forçar aberto/fechado. Mostrar ou esconder esgotados.</li><li>Banner, logo e favicon. Trocar sua senha.</li>
        <li><b>Zerar dados</b>: apaga estoque, pedidos, financeiro e/ou produtos para começar do zero. Pede a sua senha e uma confirmação.</li></ul>`)}
      ${sec('🛒', 'Como o cliente compra', '', `<ol><li>Na loja, escolhe os produtos e toca em “Finalizar pedido”.</li><li>Preenche nome, WhatsApp, bairro, endereço e forma de pagamento (e troco, se for dinheiro).</li>
        <li>O pedido é salvo no painel e abre o WhatsApp da loja com a mensagem pronta.</li><li>Em “Meu pedido”, o cliente digita o telefone e acompanha: Recebido → Em preparação → A caminho → Entregue.</li></ol>`)}
      </div>`;
    },
    async configuracoes() {
      const s = await api('/admin/settings');
      const f = (k, l, t = 'text', extra = '') => `<div class="field"><label>${l}</label><input name="${k}" type="${t}" value="${esc(s[k] || '')}" ${extra}></div>`;
      view.innerHTML = `<form id="cfg" class="cols">
        <div class="panel form"><h3 class="field full">Loja e WhatsApp</h3>${f('store_name', 'Nome da loja')}${f('tagline', 'Texto do cabeçalho')}
          ${f('whatsapp', 'WhatsApp que recebe pedidos (com DDI e DDD, ex. 5551999999999)', 'tel')}${f('payment_methods', 'Formas de pagamento (separadas por vírgula)')}</div>
        <div class="panel form"><h3 class="field full">Endereço da loja</h3>${f('store_address', 'Rua e número da loja')}${f('store_city', 'Cidade, UF')}
          ${f('auto_deliver_minutes', 'Minutos para baixa automática como entregue', 'number', 'min="5"')}
          <p class="muted field full"></p></div>
        <div class="panel form"><h3 class="field full">Horário de funcionamento</h3>${f('open_time', 'Abre às', 'time')}${f('close_time', 'Fecha às', 'time')}
          <div class="field full"><label>Modo</label><select name="store_open"><option value="auto">Automático pelo horário</option><option value="1" ${s.store_open === '1' ? 'selected' : ''}>Forçar ABERTO</option><option value="0" ${s.store_open === '0' ? 'selected' : ''}>Forçar FECHADO</option></select></div>
          <div class="field full"><label>Produtos esgotados na loja</label><select name="show_sold_out"><option value="1">Mostrar como ESGOTADO</option><option value="0" ${s.show_sold_out === '0' ? 'selected' : ''}>Esconder</option></select></div></div>
        <div class="panel form"><h3 class="field full">Banner principal (promoção / destaque)</h3><div class="field full"><label>Mostrar banner na loja</label><select name="hero_enabled"><option value="1">✅ Ativado</option><option value="0" ${s.hero_enabled === '0' ? 'selected' : ''}>⛔ Desativado</option></select></div>${f('hero_title', 'Título')}${f('hero_subtitle', 'Subtítulo')}${imgField('hero_image', s.hero_image, 'Imagem do banner')}</div>
        <div class="panel form"><h3 class="field full">Identidade visual</h3>${imgField('logo', s.logo, 'Logo principal')}${imgField('favicon', s.favicon, 'Favicon (ícone da aba)')}</div>
        <div class="field full"><button class="btn btn-primary" type="submit">SALVAR CONFIGURAÇÕES</button></div></form>
        <div class="panel"><h3>Alterar minha senha</h3><form id="pw" class="toolbar"><div class="field"><label>Senha atual</label><input name="current" type="password" required></div><div class="field"><label>Nova senha (8+)</label><input name="next" type="password" minlength="8" required></div><button class="btn btn-ghost">Alterar senha</button></form></div>
        <div class="panel danger"><h3>⚠️ Zerar dados (começar do zero)</h3>
          <p class="muted">Use para apagar os dados de exemplo e cadastrar tudo que é seu. <b>Não dá para desfazer.</b> Configurações, bairros, categorias e seu login continuam.</p>
          <form id="reset" class="form">
            <label class="chk"><input type="checkbox" name="what" value="estoque"> <span><b>Zerar estoque</b> — todas as quantidades voltam a 0 e o histórico de entradas/saídas é apagado</span></label>
            <label class="chk"><input type="checkbox" name="what" value="pedidos"> <span><b>Zerar pedidos</b> — apaga todos os pedidos, vendas e clientes; numeração volta para #000001</span></label>
            <label class="chk"><input type="checkbox" name="what" value="financeiro"> <span><b>Zerar financeiro</b> — apaga todos os lançamentos de entrada e saída</span></label>
            <label class="chk"><input type="checkbox" name="what" value="produtos"> <span><b>Apagar todos os produtos</b> — remove o catálogo inteiro (também zera estoque e pedidos)</span></label>
            <div class="field"><label>Digite sua senha para confirmar</label><input name="password" type="password" required autocomplete="current-password"></div>
            <label class="chk"><input type="checkbox" name="ok" required> <span>Entendo que os dados escolhidos serão apagados para sempre</span></label>
            <button class="btn btn-danger">ZERAR DADOS SELECIONADOS</button>
          </form></div>`;
      bindImgFields(view);
      $('#cfg').onsubmit = async (e) => { e.preventDefault(); await api('/admin/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Configurações salvas ✓'); pages.configuracoes(); };
      $('#reset').onsubmit = async (e) => {
        e.preventDefault(); const f = e.target, what = [...f.querySelectorAll('[name=what]:checked')].map((x) => x.value);
        if (!what.length) return toast('Marque o que deseja zerar');
        if (!confirm('Última confirmação: apagar ' + what.join(', ') + '? Não dá para desfazer.')) return;
        try { await api('/admin/reset', { method: 'POST', body: { password: f.password.value, what } }); f.reset(); toast('Dados zerados ✓'); lastId = null; }
        catch (err) { toast(err.message || 'Erro'); }
      };
      $('#pw').onsubmit = async (e) => { e.preventDefault(); await api('/auth/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); toast('Senha alterada ✓'); };
    },
  };

  // ---------- Novos pedidos: aviso sonoro em qualquer tela ----------
  let soundOn = localStorage.getItem('nsd_sound') !== '0', liveRefresh = null, lastId = null, actx;
  function ding() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
      [[880, 0], [1320, .18], [880, .36], [1320, .54]].forEach(([f, t]) => {
        const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(.5, actx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + t + .16);
        o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .18);
      });
    } catch {}
  }
  document.addEventListener('click', () => { if (soundOn && !actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } }, { once: true });
  function newOrderAlert() {
    if (soundOn) ding();
    const b = $('#newOrder'); b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 12000);
    showOrderPopup();
    document.title = '🔔 NOVO PEDIDO — Painel'; setTimeout(() => (document.title = 'Painel — No Silva Drinks'), 15000);
  }
  let popupDing;
  async function showOrderPopup() {
    try {
      const d = await api('/admin/orders/live'), o = d.orders.filter((x) => x.source === 'site').sort((a, b) => b.id - a.id)[0]; if (!o) return;
      let m = $('#orderPopup'); if (!m) { m = document.createElement('div'); m.id = 'orderPopup'; m.className = 'order-pop'; document.body.appendChild(m); }
      m.innerHTML = `<div class="order-pop-box"><div class="order-pop-h">🔔 NOVO PEDIDO #${String(o.order_number).padStart(6, '0')}</div>
        <div><b>${esc(o.customer_name)}</b> <span class="muted">${esc(o.customer_phone || '')}</span></div>
        <div class="muted">${esc(o.neighborhood_name || '')} · ${esc(o.address || '')}</div>
        <div class="items">${o.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join('<br>')}</div>
        ${o.notes ? `<div class="muted">Obs: ${esc(o.notes)}</div>` : ''}
        <div class="row"><span>Total</span><b style="font-size:1.4rem">${brl(o.total)}</b></div>
        <div class="row"><span>Pagamento</span><b>${esc(o.payment_method || '—')}</b></div>${troco(o)}
        <div class="actions"><a class="btn btn-primary" href="#aovivo" data-popclose>VER PEDIDO</a><button class="btn btn-ghost" data-popclose>Fechar</button></div></div>`;
      m.classList.add('show');
      clearInterval(popupDing); popupDing = setInterval(() => soundOn && ding(), 6000);
      m.onclick = (e) => { if (e.target === m || e.target.closest('[data-popclose]')) { m.classList.remove('show'); clearInterval(popupDing); } };
    } catch {}
  }
  async function watch() {
    try {
      const r = await fetch(API + '/admin/orders/last'); if (!r.ok) return;
      const { id } = await r.json();
      if (lastId !== null && id > lastId) newOrderAlert();
      lastId = id;
      if (liveRefresh) await liveRefresh();
    } catch {}
  }
  let watching = false;
  function startWatch() { if (watching) return; watching = true; watch(); setInterval(watch, 8000); }
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((ok, fail) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      const js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.onload = ok; js.onerror = fail; document.head.appendChild(js);
    });
  }

  // ---------- Navegação ----------
  const TITLES = { dashboard: 'Dashboard', aovivo: 'Pedidos ao vivo', pedidos: 'Pedidos / Vendas', venda: 'Venda manual', baixa: 'Baixa rápida', estoque: 'Estoque', produtos: 'Produtos', categorias: 'Categorias', bairros: 'Bairros e taxas', financeiro: 'Financeiro', clientes: 'Clientes', configuracoes: 'Configurações', tutorial: 'Tutorial' };
  async function route() {
    const p = (location.hash.slice(1) || 'dashboard').split('?')[0], page = pages[p] ? p : 'dashboard';
    charts.forEach((c) => c.destroy()); charts = []; view.onclick = null; liveRefresh = null;
    $('#pageTitle').textContent = TITLES[page];
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + page));
    $('#side').classList.remove('open'); $('#sideOverlay').classList.remove('open');
    view.innerHTML = '<p class="muted">Carregando…</p>';
    try { await pages[page](); } catch (e) { console.error(e); }
  }
  window.addEventListener('hashchange', route);
  $('#menuBtn').onclick = () => { $('#side').classList.add('open'); $('#sideOverlay').classList.add('open'); };
  $('#sideOverlay').onclick = () => { $('#side').classList.remove('open'); $('#sideOverlay').classList.remove('open'); };

  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault(); $('#loginErr').innerHTML = '';
    const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    const j = await r.json(); if (!r.ok) return ($('#loginErr').innerHTML = `<div class="alert">${esc(j.error)}</div>`);
    start(j.name);
  };
  $('#logout').onclick = async () => { await fetch(API + '/auth/logout', { method: 'POST' }); showLogin(); };
  function start(name) { $('#login').hidden = true; $('#app').hidden = false; $('#userName').textContent = name; route(); startWatch(); }
  fetch(API + '/auth/me').then((r) => (r.ok ? r.json().then((u) => start(u.name)) : showLogin())).catch(showLogin);
})();
