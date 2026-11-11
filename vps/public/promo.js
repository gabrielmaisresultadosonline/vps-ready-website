// No Silva Drinks — regras de promoções e destaques (mesmo arquivo usado na loja, no painel e no servidor)
(function (root) {
  var TZ = 'America/Sao_Paulo';
  var DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var r2 = function (v) { return Math.round(Number(v || 0) * 100) / 100; };
  // Dia da semana, data e hora atuais em São Paulo
  function spNow(d) {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }
  var inDates = function (x, n) { return (!x.start_date || n.date >= String(x.start_date).slice(0, 10)) && (!x.end_date || n.date <= String(x.end_date).slice(0, 10)); };
  var days = function (x) { return (x.days || []).map(Number); };
  function promoActive(pr, n) {
    if (!pr || !pr.active || !(Number(pr.price1) > 0)) return false;
    var d = days(pr); if (d.length && d.indexOf(n.dow) < 0) return false;
    if (!inDates(pr, n)) return false;
    var a = pr.start_time || '', b = pr.end_time || '';
    if (a && b) return a <= b ? n.time >= a && n.time <= b : n.time >= a || n.time <= b;
    if (a) return n.time >= a; if (b) return n.time <= b;
    return true;
  }
  // Promoção válida agora para cada produto (prioridade menor vence; empate = a mais antiga)
  function promoMap(promos, n) {
    var m = {};
    (promos || []).filter(function (p) { return promoActive(p, n); })
      .sort(function (a, b) { return (Number(a.priority) || 0) - (Number(b.priority) || 0) || a.id - b.id; })
      .forEach(function (p) { (p.product_ids || []).forEach(function (id) { if (!m[id]) m[id] = p; }); });
    return m;
  }
  // Total de N unidades da mesma promoção: cada 2 = preço de 2; 1 que sobra = preço de 1
  function groupTotal(pr, qty) {
    var p1 = Number(pr.price1), p2 = Number(pr.price2) > 0 ? Number(pr.price2) : p1 * 2;
    return r2(Math.floor(qty / 2) * p2 + (qty % 2) * p1);
  }
  // lines: [{product_id, quantity, price, name}] -> itens com preço final (pode dividir uma linha em 2 preços)
  function priceCart(lines, promos, n) {
    var m = promoMap(promos, n || spNow()), out = [], groups = {};
    lines.forEach(function (l) {
      var pr = m[l.product_id];
      if (!pr) out.push({ product_id: l.product_id, name: l.name, quantity: l.quantity, unit_price: r2(l.price), base_price: r2(l.price), promotion: null });
      else (groups[pr.id] = groups[pr.id] || { pr: pr, lines: [] }).lines.push(l);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], pr = g.pr, p1 = Number(pr.price1), p2 = Number(pr.price2) > 0 ? Number(pr.price2) : p1 * 2;
      var total = g.lines.reduce(function (a, l) { return a + l.quantity; }, 0), pairs = Math.floor(total / 2) * 2, used = 0;
      g.lines.forEach(function (l) {
        var inPair = Math.max(0, Math.min(l.quantity, pairs - used)), single = l.quantity - inPair; used += l.quantity;
        var base = { product_id: l.product_id, name: l.name, base_price: r2(l.price), promotion: pr.name, promotion_id: pr.id };
        if (inPair) out.push(Object.assign({}, base, { quantity: inPair, unit_price: r2(p2 / 2) }));
        if (single) out.push(Object.assign({}, base, { quantity: single, unit_price: r2(p1) }));
      });
    });
    var subtotal = r2(out.reduce(function (a, x) { return a + x.unit_price * x.quantity; }, 0));
    var original = r2(out.reduce(function (a, x) { return a + x.base_price * x.quantity; }, 0));
    return { items: out, subtotal: subtotal, discount: r2(Math.max(0, original - subtotal)) };
  }
  // Destaques do dia: os do dia de hoje; se não houver, os gerais (sem dia marcado); senão nenhum
  function dayHighlights(list, n) {
    var ok = (list || []).filter(function (h) { return h.active && inDates(h, n); });
    var today = ok.filter(function (h) { return days(h).indexOf(n.dow) >= 0; });
    var pick = today.length ? today : ok.filter(function (h) { return !days(h).length; });
    return pick.sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || a.id - b.id; });
  }
  var api = { TZ: TZ, DAYS: DAYS, spNow: spNow, promoActive: promoActive, promoMap: promoMap, groupTotal: groupTotal, priceCart: priceCart, dayHighlights: dayHighlights };
  root.NSDPromo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
