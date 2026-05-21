import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmployeeData {
  nome: string;
  cpf?: string | null;
  cargo?: string | null;
  jornada_padrao_horas?: number | null;
}

interface CreateBody {
  nome: string;
  email: string;
  password: string;
  role: "admin" | "revisor" | "funcionario";
  // somente quando role = funcionario
  employee_id?: string | null;
  employee_data?: EmployeeData | null;
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

    const callerClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    const body = (await req.json()) as CreateBody;
    const nome = (body.nome ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const role = body.role;

    if (!nome || nome.length < 2) return json({ error: "Nome inválido" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (password.length < 6) return json({ error: "Senha mínima de 6 caracteres" }, 400);
    if (!["admin", "revisor", "funcionario"].includes(role)) return json({ error: "Perfil inválido" }, 400);

    // Validações específicas para funcionário
    let targetEmployeeId: string | null = null;
    if (role === "funcionario") {
      if (body.employee_id) {
        const { data: emp } = await admin
          .from("employees")
          .select("id, company_id, user_id")
          .eq("id", body.employee_id)
          .maybeSingle();
        if (!emp || emp.company_id !== companyId) {
          return json({ error: "Funcionário não pertence à sua empresa" }, 403);
        }
        if (emp.user_id) {
          return json({ error: "Este funcionário já possui um acesso vinculado" }, 400);
        }
        targetEmployeeId = emp.id;
      } else if (body.employee_data) {
        const ed = body.employee_data;
        if (!ed.nome || ed.nome.trim().length < 2) {
          return json({ error: "Nome do funcionário inválido" }, 400);
        }
      } else {
        return json({ error: "Informe employee_id ou employee_data" }, 400);
      }
    }

    // Cria auth user
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

    const { data: newProfile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", newUserId)
      .maybeSingle();
    const fantasmaCompanyId = newProfile?.company_id;

    await admin
      .from("profiles")
      .update({ company_id: companyId, nome, email })
      .eq("id", newUserId);

    await admin.from("user_roles").delete().eq("user_id", newUserId);
    await admin.from("user_roles").insert({
      user_id: newUserId,
      company_id: companyId,
      role,
    });

    if (fantasmaCompanyId && fantasmaCompanyId !== companyId) {
      await admin.from("companies").delete().eq("id", fantasmaCompanyId);
    }

    // Vincula / cria employee se for funcionário
    let employeeId: string | null = null;
    if (role === "funcionario") {
      if (targetEmployeeId) {
        await admin
          .from("employees")
          .update({ user_id: newUserId, email })
          .eq("id", targetEmployeeId);
        employeeId = targetEmployeeId;
      } else if (body.employee_data) {
        const ed = body.employee_data;
        const { data: newEmp, error: empErr } = await admin
          .from("employees")
          .insert({
            company_id: companyId,
            user_id: newUserId,
            nome: ed.nome.trim(),
            cpf: ed.cpf?.trim() || null,
            cargo: ed.cargo?.trim() || null,
            jornada_padrao_horas: ed.jornada_padrao_horas ?? 8,
            email,
            status: "ativo",
          })
          .select("id")
          .single();
        if (empErr) {
          return json({ error: "Usuário criado, mas falhou ao criar funcionário: " + empErr.message }, 500);
        }
        employeeId = newEmp?.id ?? null;
      }
    }

    return json({ ok: true, user_id: newUserId, employee_id: employeeId });
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
