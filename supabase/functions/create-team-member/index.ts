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

async function getAuthedUserId(req: Request) {
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

  // No admin exists yet: bootstrap the caller as admin
  await supabaseAdmin.from("user_roles").insert({ user_id: callerUserId, role: "admin" });
  await supabaseAdmin.from("profiles").upsert({
    id: callerUserId,
    email: callerEmail,
    name: callerName,
  });

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

async function findUserIdByEmail(supabaseAdmin: any, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email ?? "").toLowerCase() === target);
    if (found) return found.id as string;

    if (users.length < perPage) break;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, email, phone, password, role } = await req.json();

    const trimmedName = String(name ?? "").trim();
    const trimmedEmail = String(email ?? "").trim().toLowerCase();
    const trimmedPhone = String(phone ?? "").trim();
    const trimmedPassword = String(password ?? "").trim();
    const trimmedRole = String(role ?? "").trim() as AppRole;

    if (!trimmedName || !trimmedEmail || !trimmedPassword || !trimmedRole) {
      return json(400, { error: "Todos os campos são obrigatórios" });
    }

    if (!trimmedEmail.includes("@")) {
      return json(400, { error: "E-mail inválido" });
    }

    if (trimmedPassword.length < 6) {
      return json(400, { error: "A senha deve ter pelo menos 6 caracteres" });
    }

    const validRoles: AppRole[] = ["admin", "suporte", "gestor_trafego", "closer", "sdr"];
    if (!validRoles.includes(trimmedRole)) {
      return json(400, { error: "Função inválida" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Auth + admin check (bootstrap first admin if none exists yet)
    const caller = await getAuthedUserId(req);
    if (!caller.userId) return json(401, { error: caller.error || "Não autenticado" });

    await ensureBootstrapAdmin(supabaseAdmin, caller.userId, caller.email ?? null, caller.name ?? null);

    const callerIsAdmin = await isCallerAdmin(supabaseAdmin, caller.userId);
    if (!callerIsAdmin) return json(403, { error: "Apenas administradores podem cadastrar membros" });

    // If the email already exists, update that user instead of failing
    const existingUserId = await findUserIdByEmail(supabaseAdmin, trimmedEmail);

    let userId: string | null = null;
    let updatedExisting = false;

    if (existingUserId) {
      updatedExisting = true;
      userId = existingUserId;

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: trimmedPassword,
        user_metadata: { name: trimmedName },
      });

      if (updateAuthError) {
        console.error("[create-team-member] Error updating existing user:", updateAuthError);
        return json(400, { error: updateAuthError.message });
      }
    } else {
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail,
        password: trimmedPassword,
        email_confirm: true,
        user_metadata: { name: trimmedName },
      });

      if (createError) {
        console.error("[create-team-member] Error creating user:", createError);
        return json(400, { error: createError.message });
      }

      userId = userData?.user?.id ?? null;
      if (!userId) return json(500, { error: "Erro ao criar usuário" });
    }

    // Upsert profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, name: trimmedName, email: trimmedEmail, phone: trimmedPhone || null });

    if (profileError) {
      console.error("[create-team-member] Error upserting profile:", profileError);
    }

    // Ensure single role: replace existing roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: trimmedRole });

    if (roleError) {
      console.error("[create-team-member] Error assigning role:", roleError);
      return json(500, { error: "Erro ao atribuir função" });
    }

    // Permissions
    if (trimmedRole !== "admin") {
      const { error: permError } = await supabaseAdmin
        .from("user_permissions")
        .upsert({
          user_id: userId,
          allowed_origin_ids: [],
          allowed_sub_origin_ids: [],
        });

      if (permError) {
        console.error("[create-team-member] Error upserting permissions:", permError);
      }
    } else {
      await supabaseAdmin.from("user_permissions").delete().eq("user_id", userId);
    }

    return json(200, { success: true, user_id: userId, updated_existing: updatedExisting });
  } catch (error) {
    console.error("[create-team-member] Error:", error);
    return json(500, { error: "Erro interno do servidor" });
  }
});
