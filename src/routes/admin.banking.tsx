import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/admin/banking")({
  head: () => ({
    meta: [
      { title: "Banking — CoopOS Nigeria" },
      { name: "description", content: "Bank accounts, payments and reconciliation." },
      { property: "og:title", content: "Banking — CoopOS Nigeria" },
      { property: "og:description", content: "Bank accounts, payments and reconciliation." },
    ],
  }),
  component: AdminBankingPage,
});

function AdminBankingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Banking" description="Bank accounts, payments and reconciliation." />
      <ComingSoon
        title="Banking is not built yet"
        capabilities={["Bank accounts","Payment files","Bank reconciliation"]}
      />
    </div>
  );
}
