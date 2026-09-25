import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/platform/support")({
  head: () => ({
    meta: [
      { title: "Support — CoopOS Nigeria" },
      { name: "description", content: "Support tickets and service requests." },
      { property: "og:title", content: "Support — CoopOS Nigeria" },
      { property: "og:description", content: "Support tickets and service requests." },
    ],
  }),
  component: PlatformSupportPage,
});

function PlatformSupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Support tickets and service requests." />
      <ComingSoon
        title="Support is not built yet"
        capabilities={["Ticket queue","SLA tracking","Escalations"]}
      />
    </div>
  );
}
