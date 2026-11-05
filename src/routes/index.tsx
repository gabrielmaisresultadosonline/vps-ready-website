import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "No Silva Drinks — Delivery de bebidas em São Leopoldo" },
      {
        name: "description",
        content: "Peça cervejas, destilados, energéticos e gelo. Delivery rápido na Campina e região.",
      },
      { property: "og:title", content: "No Silva Drinks — Delivery de bebidas" },
      {
        property: "og:description",
        content: "Sua bebida favorita chega até você. Peça pelo site e finalize no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-sm">
        <span className="font-display text-lg tracking-wide">
          NO SILVA <span className="text-primary">DRINKS</span>
        </span>
        <span className="text-muted-foreground">Pré-visualização da loja (produtos de exemplo)</span>
        <div className="ml-auto flex gap-2">
          <a href="/loja/index.html" target="_blank" rel="noopener" className="rounded-lg border border-border px-3 py-1.5 font-semibold">
            Abrir em tela cheia
          </a>
          <a href="/nosilva-drinks.zip" download className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
            Baixar para VPS (.zip)
          </a>
        </div>
      </div>
      <iframe src="/loja/index.html" title="Loja No Silva Drinks" className="w-full flex-1 border-0" />
    </main>
  );
}
