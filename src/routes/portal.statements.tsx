import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/portal/statements")({
  head: () => ({
    meta: [
      { title: "Statements — CoopOS Nigeria" },
      { name: "description", content: "Downloadable member statements." },
      { property: "og:title", content: "Statements — CoopOS Nigeria" },
      { property: "og:description", content: "Downloadable member statements." },
    ],
  }),
  component: PortalStatementsPage,
});

function PortalStatementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Statements" description="Downloadable member statements." />
      <ComingSoon
        title="Statements is not built yet"
        capabilities={["Period statements","Downloadable PDFs","Email delivery"]}
      />
    </div>
  );
}
