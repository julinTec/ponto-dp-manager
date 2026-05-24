// admission-approve
// Aprova uma admissão: cria/atualiza o funcionário e vincula documentos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeia tipo de admission_documents para employee_documents.document_type
const DOC_TYPE_MAP: Record<string, string> = {
  rg: "rg",
  cpf: "cpf",
  cnh: "cnh",
  ctps: "ctps",
  contrato: "contrato",
  exame_admissional: "exame_admissional",
  comprovante_residencia: "comprovante_residencia",
  certidao_nascimento: "certidao_nascimento",
  certidao_casamento: "certidao_casamento",
  certificado_escolar: "certificado_escolar",
  titulo_eleitor: "titulo_eleitor",
  pis_pasep: "pis_pasep",
  reservista: "reservista",
  ficha: "ficha",
  outro: "outro",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admission_id, complementos = {} } = await req.json();
    if (!admission_id) throw new Error("admission_id obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // valida usuário chamador
    const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authed.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Carrega admissão e documentos
    const { data: adm, error: aErr } = await admin
      .from("employee_admissions")
      .select("id, company_id, employee_id, dados_extraidos, status")
      .eq("id", admission_id)
      .single();
    if (aErr) throw aErr;

    // checa permissão: super_admin OU admin/dp da empresa
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", userData.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    const isCompanyAdmin = (roles ?? []).some((r: any) =>
      r.company_id === adm.company_id && (r.role === "admin" || r.role === "dp")
    );
    if (!isSuper && !isCompanyAdmin) {
      return new Response(JSON.stringify({ error: "sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dados = (adm.dados_extraidos as any) ?? {};

    // monta payload do funcionário
    const employeePayload: any = {
      company_id: adm.company_id,
      nome: complementos.nome ?? dados.nome ?? null,
      cpf: complementos.cpf ?? dados.cpf ?? null,
      rg: dados.rg ?? null,
      data_nascimento: dados.data_nascimento ?? null,
      endereco: dados.endereco ?? null,
      telefone: dados.telefone ?? null,
      email: dados.email ?? null,
      cargo: complementos.cargo ?? dados.cargo ?? null,
      funcao: complementos.funcao ?? dados.funcao ?? null,
      admission_date: complementos.admission_date ?? dados.admission_date ?? null,
      salario: complementos.salario ?? dados.salario ?? null,
      jornada_padrao_horas: complementos.jornada_padrao_horas ?? dados.jornada_padrao_horas ?? 8,
      status: "ativo",
    };

    if (!employeePayload.nome) throw new Error("Nome do funcionário é obrigatório");
    if (!employeePayload.cpf) throw new Error("CPF do funcionário é obrigatório");

    // upsert por (company_id, cpf)
    let employeeId = adm.employee_id as string | null;
    if (!employeeId) {
      const { data: existing } = await admin
        .from("employees")
        .select("id")
        .eq("company_id", adm.company_id)
        .eq("cpf", employeePayload.cpf)
        .maybeSingle();

      if (existing?.id) {
        employeeId = existing.id;
        await admin.from("employees").update(employeePayload).eq("id", employeeId);
      } else {
        const { data: created, error: cErr } = await admin
          .from("employees")
          .insert(employeePayload)
          .select("id")
          .single();
        if (cErr) throw cErr;
        employeeId = created.id;
      }
    } else {
      await admin.from("employees").update(employeePayload).eq("id", employeeId);
    }

    // Vincula documentos
    const { data: docs } = await admin
      .from("admission_documents")
      .select("id, tipo, storage_path, original_name, mime_type, tamanho_bytes, dados_extraidos, confianca, ocr_text, ocr_text_clean, ai_model_used")
      .eq("admission_id", admission_id);

    for (const d of (docs ?? []) as any[]) {
      const docType = DOC_TYPE_MAP[d.tipo] ?? "outro";
      // evita duplicação se mesmo storage_path já existir
      const { data: dup } = await admin
        .from("employee_documents")
        .select("id")
        .eq("storage_path", d.storage_path)
        .maybeSingle();
      if (dup?.id) continue;

      await admin.from("employee_documents").insert({
        company_id: adm.company_id,
        employee_id: employeeId,
        document_type: docType,
        storage_path: d.storage_path,
        original_name: d.original_name,
        mime_type: d.mime_type,
        tamanho_bytes: d.tamanho_bytes,
        ai_extracted_data: d.dados_extraidos ?? {},
        confianca: d.confianca,
        ocr_text: d.ocr_text,
        ocr_text_clean: d.ocr_text_clean,
        ai_model_used: d.ai_model_used,
        extraction_status: "concluido",
        needs_review: false,
        status: "validado",
        created_by: userData.user.id,
      });
    }

    // atualiza admissão
    await admin.from("employee_admissions").update({
      status: "aprovado",
      employee_id: employeeId,
    }).eq("id", admission_id);

    // ocorrência inicial
    await admin.from("employee_occurrences").insert({
      company_id: adm.company_id,
      employee_id: employeeId,
      tipo: "outro",
      titulo: "Admissão aprovada",
      descricao: "Funcionário criado automaticamente a partir da admissão.",
      data: new Date().toISOString().slice(0, 10),
      created_by: userData.user.id,
    }).then(() => {}, () => {}); // best-effort (depende do enum tipo)

    return new Response(JSON.stringify({ ok: true, employee_id: employeeId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    console.error("admission-approve:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
