import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/platform/usage")({
  head: () => ({
    meta: [
      { title: "Usage — CoopOS Nigeria" },
      { name: "description", content: "Platform usage and adoption metrics." },
      { property: "og:title", content: "Usage — CoopOS Nigeria" },
      { property: "og:description", content: "Platform usage and adoption metrics." },
    ],
  }),
  component: PlatformUsagePage,
});

function PlatformUsagePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Usage" description="Platform usage and adoption metrics." />
      <ComingSoon
        title="Usage is not built yet"
        capabilities={["Active cooperatives","Feature usage","Growth trends"]}
      />
    </div>
  );
}
