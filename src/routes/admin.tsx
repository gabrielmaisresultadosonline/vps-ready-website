import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel — No Silva Drinks" },
      { name: "description", content: "Painel administrativo da No Silva Drinks: pedidos ao vivo, estoque e financeiro." },
      { property: "og:title", content: "Painel — No Silva Drinks" },
      { property: "og:description", content: "Pedidos ao vivo, estoque, clientes e financeiro da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  return <iframe src="/loja/admin/index.html" title="Painel No Silva Drinks" className="fixed inset-0 h-screen w-screen border-0" />;
}
