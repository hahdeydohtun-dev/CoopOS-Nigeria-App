import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORM_ROLES = ["PLATFORM_SUPER_ADMIN", "PLATFORM_SUPPORT", "PLATFORM_AUDITOR"] as const;

/** Read-only: is the platform still unclaimed (no platform administrator yet)? */
export const getBootstrapState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .in("role", PLATFORM_ROLES);
    const { data: demo } = await supabaseAdmin
      .from("cooperatives")
      .select("id, legal_name")
      .eq("is_demo", true)
      .limit(1)
      .maybeSingle();
    return {
      platformClaimed: (count ?? 0) > 0,
      demoCooperative: demo ?? null,
    };
  });

/** First-run setup: the first signed-in user may claim platform administration. */
export const claimPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .in("role", PLATFORM_ROLES);
    if ((count ?? 0) > 0) {
      throw new Error("Platform administration has already been claimed.");
    }

    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("key", "PLATFORM_SUPER_ADMIN")
      .is("cooperative_id", null)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      role: "PLATFORM_SUPER_ADMIN",
      role_id: role?.id ?? null,
      cooperative_id: null,
      status: "ACTIVE",
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({ is_platform_user: true })
      .eq("id", context.userId);

    return { ok: true };
  });

/** Join the clearly-marked demo cooperative as an administrator, for exploration. */
export const joinDemoCooperative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: demo } = await supabaseAdmin
      .from("cooperatives")
      .select("id")
      .eq("is_demo", true)
      .limit(1)
      .maybeSingle();
    if (!demo) throw new Error("No demo cooperative is available.");

    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("key", "COOPERATIVE_ADMIN")
      .is("cooperative_id", null)
      .maybeSingle();

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("cooperative_id", demo.id)
      .eq("role", "COOPERATIVE_ADMIN")
      .maybeSingle();
    if (existing) return { ok: true, alreadyMember: true };

    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      role: "COOPERATIVE_ADMIN",
      role_id: role?.id ?? null,
      cooperative_id: demo.id,
      status: "ACTIVE",
    });
    if (error) throw new Error(error.message);
    return { ok: true, alreadyMember: false };
  });
