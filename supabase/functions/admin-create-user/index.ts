import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateBody {
  nome: string;
  email: string;
  password: string;
  role: "admin" | "revisor";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller validation
    const callerClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get caller's company + verify admin role
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", callerId)
      .maybeSingle();
    const companyId = callerProfile?.company_id;
    if (!companyId) return json({ error: "Sem empresa associada" }, 403);

    const { data: rolesData } = await admin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", callerId);
    const isSuper = (rolesData ?? []).some((r: any) => r.role === "super_admin");
    const isAdminCompany = (rolesData ?? []).some(
      (r: any) => r.role === "admin" && r.company_id === companyId,
    );
    if (!isSuper && !isAdminCompany) {
      return json({ error: "Apenas administradores podem criar usuários" }, 403);
    }

    // Parse + validate body
    const body = (await req.json()) as CreateBody;
    const nome = (body.nome ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const role = body.role;

    if (!nome || nome.length < 2) return json({ error: "Nome inválido" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (password.length < 6) return json({ error: "Senha mínima de 6 caracteres" }, 400);
    if (role !== "admin" && role !== "revisor") return json({ error: "Perfil inválido" }, 400);

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, empresa: "__placeholder__" },
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message ?? "Falha ao criar usuário" }, 400);
    }
    const newUserId = created.user.id;

    // The trigger handle_new_user already created:
    //  - a new "fantasma" company
    //  - a profile pointing to that company
    //  - a user_roles row (admin) for that company
    // We need to: reassign profile.company_id, replace role, and delete fantasma company.

    // Read fantasma company id from the auto-created profile
    const { data: newProfile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", newUserId)
      .maybeSingle();
    const fantasmaCompanyId = newProfile?.company_id;

    // Re-point profile to caller's company
    await admin
      .from("profiles")
      .update({ company_id: companyId, nome })
      .eq("id", newUserId);

    // Remove auto-created roles, insert chosen role
    await admin.from("user_roles").delete().eq("user_id", newUserId);
    await admin.from("user_roles").insert({
      user_id: newUserId,
      company_id: companyId,
      role,
    });

    // Delete fantasma company if it's different
    if (fantasmaCompanyId && fantasmaCompanyId !== companyId) {
      await admin.from("companies").delete().eq("id", fantasmaCompanyId);
    }

    return json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    console.error("admin-create-user error", e);
    return json({ error: e?.message ?? "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
