import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Membership = {
  cooperativeId: string | null;
  role: AppRole;
  roleId: string | null;
};

type AccessData = {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    status: Database["public"]["Enums"]["user_status"];
    is_platform_user: boolean;
  } | null;
  memberships: Membership[];
  permissions: string[];
  cooperative: {
    id: string;
    legal_name: string;
    trading_name: string | null;
    is_demo: boolean;
    status: Database["public"]["Enums"]["cooperative_status"];
    currency: string;
  } | null;
};

const PLATFORM_ROLES: AppRole[] = ["PLATFORM_SUPER_ADMIN", "PLATFORM_SUPPORT", "PLATFORM_AUDITOR"];

async function loadAccess(userId: string): Promise<AccessData> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, status, is_platform_user")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("cooperative_id, role, role_id, status").eq("user_id", userId),
  ]);

  const memberships: Membership[] = (roleRows ?? [])
    .filter((r) => r.status === "ACTIVE")
    .map((r) => ({ cooperativeId: r.cooperative_id, role: r.role, roleId: r.role_id }));

  const roleIds = memberships.map((m) => m.roleId).filter((v): v is string => Boolean(v));
  let permissions: string[] = [];
  if (roleIds.length > 0) {
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("permissions(code)")
      .in("role_id", roleIds);
    permissions = Array.from(
      new Set(
        (perms ?? [])
          .map((row) => (row as { permissions: { code: string } | null }).permissions?.code)
          .filter((c): c is string => Boolean(c)),
      ),
    );
  }

  const coopId = memberships.find((m) => m.cooperativeId)?.cooperativeId ?? null;
  let cooperative: AccessData["cooperative"] = null;
  if (coopId) {
    const { data } = await supabase
      .from("cooperatives")
      .select("id, legal_name, trading_name, is_demo, status, currency")
      .eq("id", coopId)
      .maybeSingle();
    cooperative = data ?? null;
  }

  return { profile: profile ?? null, memberships, permissions, cooperative };
}

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  accessLoading: boolean;
  profile: AccessData["profile"];
  cooperative: AccessData["cooperative"];
  memberships: Membership[];
  roles: AppRole[];
  permissions: string[];
  isPlatformAdmin: boolean;
  isCooperativeStaff: boolean;
  hasPermission: (code?: string) => boolean;
  refreshAccess: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  const access = useQuery({
    queryKey: ["access", userId],
    enabled: Boolean(userId),
    queryFn: () => loadAccess(userId!),
    staleTime: 60_000,
  });

  const value = useMemo<SessionContextValue>(() => {
    const data = access.data;
    const memberships = data?.memberships ?? [];
    const roles = memberships.map((m) => m.role);
    const permissions = data?.permissions ?? [];
    const isPlatformAdmin = roles.some((r) => PLATFORM_ROLES.includes(r));
    return {
      session,
      user: session?.user ?? null,
      authLoading,
      accessLoading: Boolean(userId) && access.isPending,
      profile: data?.profile ?? null,
      cooperative: data?.cooperative ?? null,
      memberships,
      roles,
      permissions,
      isPlatformAdmin,
      isCooperativeStaff: memberships.some((m) => m.cooperativeId && m.role !== "MEMBER"),
      hasPermission: (code?: string) =>
        !code || isPlatformAdmin || permissions.includes(code),
      refreshAccess: () => void access.refetch(),
    };
  }, [session, authLoading, userId, access]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export const roleLabel = (role: AppRole) =>
  role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
