import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Building2,
  ClipboardList,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoopOS Nigeria — Cooperative management platform" },
      {
        name: "description",
        content:
          "CoopOS Nigeria is a multi-tenant platform for Nigerian cooperative societies: members, savings, loans, accounting and governance in one secure system.",
      },
      { property: "og:title", content: "CoopOS Nigeria — Cooperative management platform" },
      {
        property: "og:description",
        content:
          "Multi-tenant management for Nigerian cooperative societies: members, roles, approvals, double-entry accounting and audit trails.",
      },
    ],
  }),
  component: Landing,
});

const pillars = [
  {
    icon: Building2,
    title: "Multi-cooperative by design",
    body: "Every cooperative and branch is fully separated, so no society ever sees another's records.",
  },
  {
    icon: Users,
    title: "Roles and permissions",
    body: "Fifteen built-in roles, from platform administrator to member, each with precise permissions.",
  },
  {
    icon: ClipboardList,
    title: "Maker, checker, approver",
    body: "Sensitive actions follow an approval trail, and nobody can approve their own request.",
  },
  {
    icon: BookOpenCheck,
    title: "Double-entry accounting",
    body: "A chart of accounts, accounting periods and balanced journals underpin every figure.",
  },
  {
    icon: Landmark,
    title: "Configurable rules",
    body: "Interest, dues, loan limits and cycles are settings per cooperative — never hard-coded.",
  },
  {
    icon: ShieldCheck,
    title: "Audited and immutable",
    body: "Posted financial records cannot be edited, and every change is written to the audit trail.",
  },
];

function Landing() {
  const { user, authLoading } = useSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="size-5" aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold tracking-tight">CoopOS Nigeria</span>
        </div>
        <div className="flex items-center gap-2">
          {authLoading ? null : user ? (
            <Button asChild>
              <Link to="/portal">Open my dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create account
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
          <Badge variant="secondary" className="mb-4">
            Phase 1 — Foundation
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Run your cooperative society on records you can trust.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            CoopOS Nigeria gives cooperative societies one secure home for members, roles,
            approvals and accounting. This first release ships the foundation: identity,
            permissions, cooperative settings and the financial ledger everything else will
            stand on.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Get started
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            A clearly labelled demo cooperative is included so you can explore safely. Demo
            records are marked everywhere they appear.
          </p>
        </section>

        <section className="border-y bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => (
              <Card key={p.title} className="h-full">
                <CardContent className="space-y-3 p-6">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <p.icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="text-base font-semibold">{p.title}</h2>
                  <p className="text-sm text-muted-foreground">{p.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">What comes next</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Savings, check-off, loans, repayments, withdrawals, banking, treasury and reporting
            each have a place in the app already. They are clearly marked as coming in the next
            phase — nothing is simulated and no invented figures are shown.
          </p>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>CoopOS Nigeria — cooperative management platform.</span>
          <span>Amounts are shown in Nigerian Naira (₦).</span>
        </div>
      </footer>
    </div>
  );
}
