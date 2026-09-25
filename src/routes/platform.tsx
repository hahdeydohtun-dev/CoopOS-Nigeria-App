import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { platformNav } from "@/lib/navigation";

export const Route = createFileRoute("/platform")({
  component: PlatformLayout,
});

function PlatformLayout() {
  return (
    <RequireAuth>
      <AppShell area="platform" nav={platformNav}>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}
