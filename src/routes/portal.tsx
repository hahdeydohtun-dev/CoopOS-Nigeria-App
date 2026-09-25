import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { memberNav } from "@/lib/navigation";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <RequireAuth>
      <AppShell area="portal" nav={memberNav}>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}
