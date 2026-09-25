import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/admin/treasury")({
  head: () => ({
    meta: [
      { title: "Treasury — CoopOS Nigeria" },
      { name: "description", content: "Liquidity, investments and cash positions." },
      { property: "og:title", content: "Treasury — CoopOS Nigeria" },
      { property: "og:description", content: "Liquidity, investments and cash positions." },
    ],
  }),
  component: AdminTreasuryPage,
});

function AdminTreasuryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Treasury" description="Liquidity, investments and cash positions." />
      <ComingSoon
        title="Treasury is not built yet"
        capabilities={["Cash positions","Investment register","Liquidity planning"]}
      />
    </div>
  );
}
