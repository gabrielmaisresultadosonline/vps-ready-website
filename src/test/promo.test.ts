import "../../vps/public/promo.js";
const P = (globalThis as any).NSDPromo;
const tue = { dow: 2, date: "2026-11-10", time: "18:00" };
const wed = { dow: 3, date: "2026-11-11", time: "18:00" };
const thu = { dow: 4, date: "2026-11-12", time: "18:00" };
const terca = { id: 1, name: "TERÇA DA CAIPIRINHA DE LIMÃO", product_ids: [11, 21], days: [2], price1: 25, price2: 40, active: true };
const quarta = { id: 2, name: "QUARTA DO CAPETA!", product_ids: [22, 23, 24, 25], days: [3], price1: 25, price2: 40, active: true };
const promos = [terca, quarta];
const cart = (lines: [number, number][]) => P.priceCart(lines.map(([id, q]) => ({ product_id: id, quantity: q, price: 30 })), promos, tue).subtotal;

describe("promoções 1 = R$25, 2 = R$40", () => {
  it("1 unidade custa 25", () => expect(cart([[11, 1]])).toBe(25));
  it("2 unidades custam 40", () => expect(cart([[11, 2]])).toBe(40));
  it("3 unidades custam 65", () => expect(cart([[11, 3]])).toBe(65));
  it("4 unidades custam 80", () => expect(cart([[11, 4]])).toBe(80));
  it("5 e 6 unidades custam 105 e 120", () => { expect(cart([[11, 5]])).toBe(105); expect(cart([[11, 6]])).toBe(120); });
  it("produtos diferentes da mesma promoção formam par", () => expect(cart([[11, 1], [21, 1]])).toBe(40));
  it("não mistura promoções diferentes", () => {
    const both = [{ ...quarta, days: [2] }, terca];
    const r = P.priceCart([{ product_id: 11, quantity: 1, price: 30 }, { product_id: 22, quantity: 1, price: 30 }], both, tue);
    expect(r.subtotal).toBe(50);
  });
  it("produto fora da promoção fica com preço normal", () => expect(cart([[9, 2]])).toBe(60));
  it("promoção de terça não vale na quarta", () => expect(P.priceCart([{ product_id: 11, quantity: 2, price: 30 }], promos, wed).subtotal).toBe(60));
  it("promoção desativada não dá desconto", () => expect(P.priceCart([{ product_id: 11, quantity: 2, price: 30 }], [{ ...terca, active: false }], tue).subtotal).toBe(60));
  it("fora do horário não vale", () => expect(P.priceCart([{ product_id: 11, quantity: 2, price: 30 }], [{ ...terca, start_time: "19:00", end_time: "23:00" }], tue).subtotal).toBe(60));
});

describe("destaques do dia", () => {
  const h = [
    { id: 1, product_id: 11, days: [2], active: true, sort_order: 0 },
    { id: 2, product_id: 22, days: [3], active: true, sort_order: 0 },
    { id: 3, product_id: 5, days: [], active: true, sort_order: 0 },
  ];
  it("terça mostra os da terça", () => expect(P.dayHighlights(h, tue).map((x: any) => x.product_id)).toEqual([11]));
  it("quarta mostra os da quarta", () => expect(P.dayHighlights(h, wed).map((x: any) => x.product_id)).toEqual([22]));
  it("outro dia sem destaque próprio mostra os gerais", () => expect(P.dayHighlights(h, thu).map((x: any) => x.product_id)).toEqual([5]));
  it("sem nenhum destaque válido, a faixa fica vazia", () => expect(P.dayHighlights([{ ...h[0], active: false }], thu)).toEqual([]));
});
