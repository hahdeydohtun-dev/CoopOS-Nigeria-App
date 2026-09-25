import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/admin/governance")({
  head: () => ({
    meta: [
      { title: "Governance — CoopOS Nigeria" },
      { name: "description", content: "Meetings, resolutions and elections." },
      { property: "og:title", content: "Governance — CoopOS Nigeria" },
      { property: "og:description", content: "Meetings, resolutions and elections." },
    ],
  }),
  component: AdminGovernancePage,
});

function AdminGovernancePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Governance" description="Meetings, resolutions and elections." />
      <ComingSoon
        title="Governance is not built yet"
        capabilities={["Meetings and minutes","Resolutions register","Elections"]}
      />
    </div>
  );
}
