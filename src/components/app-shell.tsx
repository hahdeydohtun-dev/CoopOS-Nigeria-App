import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, ShieldCheck, UserCircle, Users } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession, roleLabel } from "@/lib/session";
import type { NavGroup } from "@/lib/navigation";
import { initialsOf } from "@/lib/format";

export type AreaKey = "portal" | "admin" | "platform";

const areaMeta: Record<AreaKey, { name: string; caption: string; icon: typeof Users }> = {
  portal: { name: "Member portal", caption: "Your cooperative", icon: UserCircle },
  admin: { name: "Cooperative admin", caption: "Operations & finance", icon: Building2 },
  platform: { name: "Platform admin", caption: "CoopOS Nigeria", icon: ShieldCheck },
};

export function AppShell({
  area,
  nav,
  children,
}: {
  area: AreaKey;
  nav: NavGroup[];
  children: ReactNode;
}) {
  const { profile, cooperative, roles, hasPermission, isPlatformAdmin, isCooperativeStaff } =
    useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const Meta = areaMeta[area];

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName = profile?.full_name || profile?.email || "Signed in";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Meta.icon className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">{Meta.name}</p>
              <p className="truncate text-xs opacity-70">{Meta.caption}</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {nav.map((group) => {
            const items = group.items.filter((item) => hasPermission(item.permission));
            if (items.length === 0) return null;
            return (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => {
                      const active =
                        pathname === item.to ||
                        (item.to !== `/${area}` && pathname.startsWith(`${item.to}/`));
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                            <Link to={item.to}>
                              <item.icon aria-hidden="true" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
        <SidebarFooter>
          <div className="space-y-1 px-2 pb-1 text-xs opacity-70 group-data-[collapsible=icon]:hidden">
            {isCooperativeStaff && area !== "admin" && (
              <Link to="/admin" className="block underline-offset-2 hover:underline">
                Go to cooperative admin
              </Link>
            )}
            {area !== "portal" && (
              <Link to="/portal" className="block underline-offset-2 hover:underline">
                Go to member portal
              </Link>
            )}
            {isPlatformAdmin && area !== "platform" && (
              <Link to="/platform" className="block underline-offset-2 hover:underline">
                Go to platform admin
              </Link>
            )}
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {cooperative?.trading_name || cooperative?.legal_name || "CoopOS Nigeria"}
            </p>
          </div>
          {cooperative?.is_demo && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              Demo data
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initialsOf(displayName)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {roles.length ? roles.map(roleLabel).join(", ") : "No role assigned yet"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/portal/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/setup">Access & setup</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 space-y-6 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
