import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  claimPlatformAdmin,
  getBootstrapState,
  joinDemoCooperative,
} from "@/lib/bootstrap.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-run setup — CoopOS Nigeria" },
      { name: "description", content: "Claim platform administration or open the demo cooperative." },
      { property: "og:title", content: "First-run setup — CoopOS Nigeria" },
      { property: "og:description", content: "Claim platform administration or open the demo cooperative." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <SetupPage />
    </RequireAuth>
  ),
});

function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, refreshAccess } = useSession();

  const fetchState = useServerFn(getBootstrapState);
  const claim = useServerFn(claimPlatformAdmin);
  const join = useServerFn(joinDemoCooperative);

  const state = useQuery({
    queryKey: ["bootstrap-state"],
    queryFn: () => fetchState(),
  });

  const claimMutation = useMutation({
    mutationFn: () => claim(),
    onSuccess: async () => {
      toast.success("You are now the platform administrator.");
      refreshAccess();
      await queryClient.invalidateQueries({ queryKey: ["bootstrap-state"] });
      navigate({ to: "/platform" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const joinMutation = useMutation({
    mutationFn: () => join(),
    onSuccess: async () => {
      toast.success("Demo cooperative opened.");
      refreshAccess();
      navigate({ to: "/admin" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const claimed = state.data?.platformClaimed;
  const demo = state.data?.demoCooperative;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <PageHeader
        title="First-run setup"
        description={`Signed in as ${profile?.email ?? "your account"}. Choose how you want to start.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Platform administration</CardTitle>
          <CardDescription>
            The first person to set up this installation becomes the platform administrator, who can
            create and oversee cooperatives.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {state.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : claimed ? (
            <p className="text-sm text-muted-foreground">
              Platform administration has already been claimed on this installation.
            </p>
          ) : (
            <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
              {claimMutation.isPending ? "Setting up…" : "Claim platform administration"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Demo cooperative
            <Badge variant="secondary">Demo data</Badge>
          </CardTitle>
          <CardDescription>
            {demo
              ? `${demo.legal_name} is a clearly marked sample cooperative with members, rules and a chart of accounts. It holds no real money and no posted financial transactions.`
              : "No demo cooperative is available on this installation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => joinMutation.mutate()}
            disabled={!demo || joinMutation.isPending}
          >
            {joinMutation.isPending ? "Opening…" : "Open the demo cooperative"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
