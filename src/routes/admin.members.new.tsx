import { createFileRoute } from "@tanstack/react-router";

import { OnboardingWizard } from "@/components/member/onboarding-wizard";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/members/new")({
  head: () => ({
    meta: [
      { title: "New member application — CoopOS Nigeria" },
      {
        name: "description",
        content: "Register a new cooperative member through the guided application form.",
      },
      { property: "og:title", content: "New member application — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Register a new cooperative member through the guided application form.",
      },
    ],
  }),
  component: NewMemberPage,
});

function NewMemberPage() {
  const { cooperative } = useSession();

  return (
    <>
      <PageHeader
        title="New member application"
        description="Complete each step. Your progress is saved on this device until you submit."
      />
      {cooperative?.id ? (
        <OnboardingWizard cooperativeId={cooperative.id} />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You are not linked to a cooperative yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}
