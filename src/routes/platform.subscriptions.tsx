import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/platform/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — CoopOS Nigeria" },
      { name: "description", content: "Cooperative subscription plans and billing." },
      { property: "og:title", content: "Subscriptions — CoopOS Nigeria" },
      { property: "og:description", content: "Cooperative subscription plans and billing." },
    ],
  }),
  component: PlatformSubscriptionsPage,
});

function PlatformSubscriptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="Cooperative subscription plans and billing." />
      <ComingSoon
        title="Subscriptions is not built yet"
        capabilities={["Plans and pricing","Invoices","Payment status"]}
      />
    </div>
  );
}
