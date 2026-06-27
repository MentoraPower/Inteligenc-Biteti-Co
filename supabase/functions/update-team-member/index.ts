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

  return { userId: data.user.id, email: data.user.email ?? null, name: (data.user.user_metadata as any)?.name ?? null, error: null };
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
    const caller = await getCaller(req);
    if (!caller.userId) return json(401, { error: caller.error || "Não autenticado" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await ensureBootstrapAdmin(supabaseAdmin, caller.userId, caller.email ?? null, caller.name ?? null);
    const callerIsAdmin = await isCallerAdmin(supabaseAdmin, caller.userId);
    if (!callerIsAdmin) return json(403, { error: "Apenas administradores podem editar membros" });

    const body = await req.json();

    const userId = String(body.user_id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = body.password ? String(body.password) : null;
    const role = String(body.role ?? "").trim() as AppRole;

    const canCreateOrigins = !!body.can_create_origins;
    const canCreateSubOrigins = !!body.can_create_sub_origins;
    const allowedOriginIds = Array.isArray(body.allowed_origin_ids) ? body.allowed_origin_ids : [];
    const allowedSubOriginIds = Array.isArray(body.allowed_sub_origin_ids) ? body.allowed_sub_origin_ids : [];

    if (!userId) return json(400, { error: "user_id é obrigatório" });
    if (!name) return json(400, { error: "Nome é obrigatório" });
    if (!email) return json(400, { error: "E-mail é obrigatório" });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return json(400, { error: "E-mail inválido" });

    // Validate password if provided
    if (password && password.length < 6) {
      return json(400, { error: "A senha deve ter pelo menos 6 caracteres" });
    }

    const validRoles: AppRole[] = ["admin", "suporte", "gestor_trafego", "closer", "sdr"];
    if (!validRoles.includes(role)) return json(400, { error: "Função inválida" });

    // Build auth update object
    const authUpdate: any = {
      user_metadata: { name },
      email,
    };

    // Only update password if provided
    if (password) {
      authUpdate.password = password;
    }

    // Update auth user (name, email, password)
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);

    if (authUpdateError) return json(400, { error: authUpdateError.message });

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, name, email });

    if (profileError) return json(400, { error: "Erro ao atualizar perfil" });

    // Replace roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    if (roleError) return json(400, { error: "Erro ao salvar função" });

    // Permissions
    if (role === "admin") {
      await supabaseAdmin.from("user_permissions").delete().eq("user_id", userId);
    } else {
      const { error: permError } = await supabaseAdmin
        .from("user_permissions")
        .upsert(
          {
            user_id: userId,
            can_create_origins: canCreateOrigins,
            can_create_sub_origins: canCreateSubOrigins,
            allowed_origin_ids: allowedOriginIds,
            allowed_sub_origin_ids: allowedSubOriginIds,
          },
          { onConflict: "user_id" }
        );
      if (permError) {
        console.error("[update-team-member] Permissions upsert error:", permError);
        return json(400, { error: "Erro ao salvar permissões" });
      }
    }

    return json(200, { success: true });
  } catch (error) {
    console.error("[update-team-member] Error:", error);
    return json(500, { error: "Erro interno do servidor" });
  }
});
