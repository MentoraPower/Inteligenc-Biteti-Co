import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "admin" | "suporte" | "gestor_trafego" | "closer" | "sdr";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCaller(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { userId: null, error: "Não autenticado" };

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data.user) return { userId: null, error: "Sessão inválida" };

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    name: (data.user.user_metadata as any)?.name ?? null,
    error: null,
  };
}

async function ensureBootstrapAdmin(supabaseAdmin: any, callerUserId: string, callerEmail: string | null, callerName: string | null) {
  const { data: anyAdmin } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);

  if (anyAdmin && anyAdmin.length > 0) return { bootstrapped: false };

  await supabaseAdmin.from("user_roles").insert({ user_id: callerUserId, role: "admin" });
  await supabaseAdmin.from("profiles").upsert({ id: callerUserId, email: callerEmail, name: callerName });

  return { bootstrapped: true };
}

async function isCallerAdmin(supabaseAdmin: any, callerUserId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", callerUserId)
    .eq("role", "admin")
    .limit(1);
  return !!(data && data.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get workspace_id from query params
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    const caller = await getCaller(req);
    if (!caller.userId) return json(401, { error: caller.error || "Não autenticado" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await ensureBootstrapAdmin(supabaseAdmin, caller.userId, caller.email ?? null, caller.name ?? null);
    const callerIsAdmin = await isCallerAdmin(supabaseAdmin, caller.userId);
    if (!callerIsAdmin) return json(403, { error: "Apenas administradores podem ver a equipe" });

    const members: Array<{
      user_id: string;
      email: string | null;
      name: string | null;
      phone: string | null;
      photo_url: string | null;
      role: AppRole | null;
      created_at?: string;
      permissions: {
        can_create_origins: boolean;
        can_create_sub_origins: boolean;
        allowed_origin_ids: string[];
        allowed_sub_origin_ids: string[];
      } | null;
    }> = [];

    // If workspace_id provided, filter by workspace members
    let workspaceMemberIds: string[] | null = null;
    let workspaceMembersMap = new Map<string, { role: string; created_at: string }>();
    
    if (workspaceId) {
      const { data: workspaceMembers } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id, role, created_at")
        .eq("workspace_id", workspaceId);
      
      if (workspaceMembers && workspaceMembers.length > 0) {
        workspaceMemberIds = workspaceMembers.map((wm: any) => wm.user_id);
        workspaceMembers.forEach((wm: any) => {
          workspaceMembersMap.set(wm.user_id, { role: wm.role, created_at: wm.created_at });
        });
      } else {
        // No members in this workspace
        return json(200, { members: [] });
      }
    }

    // List users from auth
    const perPage = 1000;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) return json(500, { error: error.message });

      let users = data?.users ?? [];
      if (users.length === 0) break;

      // Filter by workspace members if workspace_id provided
      if (workspaceMemberIds) {
        users = users.filter((u: any) => workspaceMemberIds!.includes(u.id));
      }

      if (users.length === 0) {
        if ((data?.users?.length ?? 0) < perPage) break;
        continue;
      }

      const ids = users.map((u: any) => u.id);

      const [{ data: profiles }, { data: roles }, { data: perms }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, name, email, phone, photo_url").in("id", ids),
        supabaseAdmin.from("user_roles").select("user_id, role, created_at").in("user_id", ids),
        supabaseAdmin.from("user_permissions").select("user_id, can_create_origins, can_create_sub_origins, allowed_origin_ids, allowed_sub_origin_ids").in("user_id", ids),
      ]);

      const roleByUser = new Map<string, AppRole>();
      (roles ?? [])
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
        .forEach((r: any) => {
          if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
        });

      const permByUser = new Map<string, any>();
      (perms ?? []).forEach((p: any) => permByUser.set(p.user_id, p));

      const profileByUser = new Map<string, any>();
      (profiles ?? []).forEach((p: any) => profileByUser.set(p.id, p));

      for (const u of users) {
        const profile = profileByUser.get(u.id);
        const role = roleByUser.get(u.id) ?? null;
        const perm = permByUser.get(u.id) ?? null;
        const workspaceMemberInfo = workspaceMembersMap.get(u.id);

        members.push({
          user_id: u.id,
          email: profile?.email ?? u.email ?? null,
          name: profile?.name ?? (u.user_metadata as any)?.name ?? null,
          phone: profile?.phone ?? null,
          photo_url: profile?.photo_url ?? null,
          role,
          created_at: workspaceMemberInfo?.created_at ?? u.created_at,
          permissions: perm
            ? {
                can_create_origins: !!perm.can_create_origins,
                can_create_sub_origins: !!perm.can_create_sub_origins,
                allowed_origin_ids: perm.allowed_origin_ids ?? [],
                allowed_sub_origin_ids: perm.allowed_sub_origin_ids ?? [],
              }
            : null,
        });
      }

      if ((data?.users?.length ?? 0) < perPage) break;
    }

    // sort by name/email for UI stability
    members.sort((a, b) => {
      const an = (a.name || a.email || "").toLowerCase();
      const bn = (b.name || b.email || "").toLowerCase();
      return an.localeCompare(bn);
    });

    return json(200, { members });
  } catch (error) {
    console.error("[list-team-members] Error:", error);
    return json(500, { error: "Erro interno do servidor" });
  }
});
