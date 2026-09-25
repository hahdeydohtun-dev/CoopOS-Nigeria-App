import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/portal/shares")({
  head: () => ({
    meta: [
      { title: "Shares — CoopOS Nigeria" },
      { name: "description", content: "Your share capital holdings." },
      { property: "og:title", content: "Shares — CoopOS Nigeria" },
      { property: "og:description", content: "Your share capital holdings." },
    ],
  }),
  component: PortalSharesPage,
});

function PortalSharesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Shares" description="Your share capital holdings." />
      <ComingSoon
        title="Shares is not built yet"
        capabilities={["Share subscriptions","Share certificates","Dividend history"]}
      />
    </div>
  );
}
