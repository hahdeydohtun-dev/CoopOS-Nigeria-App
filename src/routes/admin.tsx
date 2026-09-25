import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { adminNav } from "@/lib/navigation";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <RequireAuth>
      <AppShell area="admin" nav={adminNav}>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}
