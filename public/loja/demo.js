// Somente para a pré-visualização: simula o servidor com produtos de exemplo.
// Este arquivo NÃO existe na versão da VPS (lá os dados vêm do banco).
(function () {
  var P = function (id, c, name, unit, price, promo, stock, featured) {
    return { id: id, category_id: c, name: name, description: '', image: '', unit: unit, sale_price: price, promo_price: promo, stock_quantity: stock, status: 'ativo', featured: !!featured, available: stock > 0 };
  };
  var data = {
    settings: {
      store_name: 'No Silva Drinks', tagline: 'Você da Campina, São Leopoldo', whatsapp: '5551999999999',
      hero_title: 'SUA BEBIDA FAVORITA CHEGA ATÉ VOCÊ!', hero_subtitle: 'Escolha, peça e receba sem sair de casa.',
      hero_image: '', logo: '', favicon: '', open_time: '10:00', close_time: '23:59',
      min_order: '0', free_delivery_above: '0', payment_methods: 'Pix,Dinheiro,Cartão',
    },
    open: true,
    categories: [
      { id: 1, name: 'ALCOÓLICOS' }, { id: 2, name: 'NÃO ALCOÓLICOS' }, { id: 3, name: 'ITENS VARIADOS' },
    ],
    products: [
      P(1, 1, 'Cerveja Heineken Long Neck', 'un', 8.9, 7.5, 48, true),
      P(2, 1, 'Cerveja Brahma Lata 350ml', 'un', 4.5, null, 120),
      P(3, 1, 'Vodka Smirnoff 998ml', 'un', 49.9, 44.9, 12, true),
      P(4, 1, 'Whisky Red Label 1L', 'un', 129.9, null, 6),
      P(5, 1, 'Gin Tanqueray 750ml', 'un', 139.9, null, 0),
      P(6, 2, 'Energético Red Bull 250ml', 'un', 11.9, null, 40, true),
      P(7, 2, 'Coca-Cola 2L', 'un', 12.9, null, 30),
      P(8, 2, 'Água Mineral 500ml', 'un', 3.5, null, 60),
      P(9, 3, 'Gelo 5kg', 'pct', 15, null, 25),
      P(10, 3, 'Carvão 4kg', 'pct', 22, null, 10),
    ],
    neighborhoods: [
      { id: 1, name: 'Campina', delivery_fee: 5, estimated_minutes: 30 },
      { id: 2, name: 'Centro', delivery_fee: 8, estimated_minutes: 40 },
      { id: 3, name: 'Scharlau', delivery_fee: 7, estimated_minutes: 35 },
    ],
  };
  var n = 1;
  var orig = window.fetch.bind(window);
  var json = function (b, s) { return Promise.resolve(new Response(JSON.stringify(b), { status: s || 200, headers: { 'Content-Type': 'application/json' } })); };
  window.fetch = function (url, opt) {
    var u = String(url);
    if (u.indexOf('api/public/store') !== -1) return json(data);
    if (u.indexOf('api/public/orders') !== -1) {
      var b = JSON.parse((opt && opt.body) || '{}');
      var txt = 'Pedido de teste (pré-visualização) — ' + (b.name || '');
      return json({ order_number: n++, whatsapp_url: 'https://wa.me/' + data.settings.whatsapp + '?text=' + encodeURIComponent(txt) });
    }
    if (u.indexOf('api/public/track') !== -1) {
      return json({ order_number: 1, status: 'saiu', total: '45.80', created_at: new Date(Date.now() - 25 * 60000).toISOString(), out_for_delivery_at: new Date(Date.now() - 12 * 60000).toISOString(), items: [{ name: 'Cerveja Heineken Long Neck', quantity: 4 }, { name: 'Gelo 5kg', quantity: 1 }], auto_deliver_minutes: 40 });
    }
    return orig(url, opt);
  };
})();
