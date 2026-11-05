import { createFileRoute } from "@tanstack/react-router";
import loja from "@/assets/preview-loja.png";
import painel from "@/assets/preview-painel.png";
import celular from "@/assets/preview-celular.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "No Silva Drinks — Loja delivery e painel de gestão" },
      {
        name: "description",
        content:
          "Sistema completo No Silva Drinks: loja de bebidas com pedido pelo WhatsApp, estoque, vendas, clientes e financeiro.",
      },
      { property: "og:title", content: "No Silva Drinks — Loja delivery e painel de gestão" },
      {
        property: "og:description",
        content: "Loja online responsiva + painel administrativo completo, pronto para instalar na VPS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  ["Baixe o pacote", "Envie o ZIP para a VPS e descompacte em /var/www/nosilva-drinks."],
  ["Rode o instalador", "sudo bash install.sh — cria banco próprio, senhas e deixa o site no ar."],
  ["Ligue o endereço", "Subdomínio novo ou caminho /drinks no site atual, sem mexer no SSL existente."],
  ["Configure no painel", "WhatsApp, bairros, produtos, estoque e sua logo em /admin."],
];

const features = [
  "Loja com categorias, busca, carrinho e pedido no WhatsApp",
  "Taxa por bairro, pedido mínimo e entrega grátis",
  "Baixa rápida de estoque com desfazer",
  "Vendas com baixa automática ao confirmar",
  "Venda manual (balcão / WhatsApp)",
  "Financeiro com CMV, lucro bruto e líquido",
  "Clientes com histórico e filtros",
  "Logo, banner e favicon pelo painel (Ctrl+V)",
];

function Index() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="font-display text-2xl tracking-wide">
              NO SILVA <span className="text-primary">DRINKS</span>
            </p>
            <h1 className="mt-4 font-display text-5xl leading-none md:text-7xl">
              Sua loja de bebidas <span className="text-primary">pronta para a VPS</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Loja online responsiva + painel administrativo completo com estoque, vendas, clientes e
              financeiro em PostgreSQL.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/nosilva-drinks.zip"
                download
                className="inline-flex items-center rounded-xl bg-neon px-6 py-3 font-bold text-primary-foreground shadow-neon transition-transform active:scale-95"
              >
                Baixar sistema completo (.zip)
              </a>
            </div>
          </div>
          <img
            src={loja}
            alt="Página inicial da loja No Silva Drinks"
            width={1280}
            height={900}
            className="w-full rounded-2xl border border-border shadow-neon"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-4xl md:text-5xl">
          Como <span className="text-primary">instalar</span>
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-border bg-card p-5">
              <span className="font-display text-4xl text-primary">0{i + 1}</span>
              <h3 className="mt-2 font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          O passo a passo completo está no arquivo LEIA-ME.md dentro do ZIP.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-16 md:grid-cols-[1fr_280px]">
        <div>
          <h2 className="font-display text-4xl md:text-5xl">
            Painel <span className="text-primary">/admin</span>
          </h2>
          <img
            src={painel}
            alt="Dashboard do painel administrativo"
            loading="lazy"
            width={1280}
            height={1000}
            className="mt-6 w-full rounded-2xl border border-border"
          />
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <span className="text-primary">●</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <img
          src={celular}
          alt="Loja no celular"
          loading="lazy"
          width={390}
          height={844}
          className="mx-auto w-full max-w-[280px] self-start rounded-3xl border border-border shadow-neon"
        />
      </section>
    </main>
  );
}
