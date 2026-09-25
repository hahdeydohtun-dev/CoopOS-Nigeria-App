import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — CoopOS Nigeria" },
      { name: "description", content: "Operational and statutory reporting." },
      { property: "og:title", content: "Reports — CoopOS Nigeria" },
      { property: "og:description", content: "Operational and statutory reporting." },
    ],
  }),
  component: AdminReportsPage,
});

function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Operational and statutory reporting." />
      <ComingSoon
        title="Reports is not built yet"
        capabilities={["Trial balance and financials","Member and portfolio reports","Regulatory returns"]}
      />
    </div>
  );
}
