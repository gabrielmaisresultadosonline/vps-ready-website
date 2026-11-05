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
    <iframe
      src="/loja/index.html"
      title="No Silva Drinks"
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}
