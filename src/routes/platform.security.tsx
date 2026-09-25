import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck, FileSearch, KeyRound } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/platform/security")({
  head: () => ({
    meta: [
      { title: "Security — CoopOS Nigeria" },
      { name: "description", content: "How CoopOS Nigeria protects cooperative data." },
      { property: "og:title", content: "Security — CoopOS Nigeria" },
      { property: "og:description", content: "How CoopOS Nigeria protects cooperative data." },
    ],
  }),
  component: SecurityPage,
});

const items = [
  {
    icon: Lock,
    title: "Tenant isolation",
    body: "Every table is protected by row-level security. A cooperative can only ever read or write its own data — enforced by the database, not just the application.",
  },
  {
    icon: KeyRound,
    title: "Role-based access",
    body: "Permissions are granted through roles and checked on every request. Segregation of duties prevents one person from both making and approving the same transaction.",
  },
  {
    icon: ShieldCheck,
    title: "Immutable financial records",
    body: "Posted transactions cannot be edited or deleted. Corrections happen through reversing entries, and journals must balance before they post.",
  },
  {
    icon: FileSearch,
    title: "Append-only audit trail",
    body: "Sensitive actions are recorded in an audit log that nobody — including administrators — can alter or remove.",
  },
];

function SecurityPage() {
  return (
    <>
      <PageHeader
        title="Security"
        description="The controls built into the Phase 1 foundation."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                <item.icon className="size-4 text-secondary-foreground" aria-hidden="true" />
              </div>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
