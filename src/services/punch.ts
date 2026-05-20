import { supabase } from "@/integrations/supabase/client";
import { getCurrentPosition } from "./geolocation";
import { haversineMeters } from "@/utils/distance";

export type PunchType = "entrada" | "saida_intervalo" | "retorno_intervalo" | "saida_final";

export interface CompanyGeofence {
  id: string;
  nome: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  raio_ponto_metros: number;
}

/** Returns the employee row + company geofence linked to the current user. */
export async function getMyEmployeeAndCompany() {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Não autenticado");

  const { data: emp, error: e1 } = await supabase
    .from("employees")
    .select("id, company_id, nome, user_id")
    .eq("user_id", uid)
    .maybeSingle();
  if (e1) throw e1;
  if (!emp) throw new Error("Funcionário não vinculado ao seu usuário. Peça ao gestor para vincular.");

  const { data: company, error: e2 } = await supabase
    .from("companies")
    .select("id, nome, endereco, latitude, longitude, raio_ponto_metros")
    .eq("id", emp.company_id)
    .maybeSingle();
  if (e2) throw e2;
  if (!company) throw new Error("Empresa não encontrada");

  return { employee: emp, company: company as CompanyGeofence };
}

export interface RegisterPunchResult {
  id: string;
  distancia_metros: number;
  dentro_do_raio: boolean;
}

export async function registrarPonto(tipo: PunchType): Promise<RegisterPunchResult> {
  const { employee, company } = await getMyEmployeeAndCompany();
  if (company.latitude == null || company.longitude == null) {
    throw new Error("A empresa ainda não tem localização cadastrada. Avise o gestor.");
  }

  const pos = await getCurrentPosition();
  const distancia = haversineMeters(
    { lat: pos.lat, lng: pos.lng },
    { lat: Number(company.latitude), lng: Number(company.longitude) }
  );
  const dentro = distancia <= company.raio_ponto_metros;

  if (!dentro) {
    throw new Error(
      `Você está a ${Math.round(distancia)} m da empresa. O raio permitido é de ${company.raio_ponto_metros} m.`
    );
  }

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user!.id;

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const { data, error } = await supabase
    .from("punch_records")
    .insert({
      company_id: company.id,
      employee_id: employee.id,
      user_id: uid,
      tipo,
      latitude: pos.lat,
      longitude: pos.lng,
      accuracy: pos.accuracy,
      distancia_metros: distancia,
      dentro_do_raio: dentro,
      origem: isMobile ? "mobile" : "web",
    })
    .select("id, distancia_metros, dentro_do_raio")
    .single();

  if (error) throw error;
  return data as RegisterPunchResult;
}

export async function listarMeusPontos(from: Date, to: Date) {
  const { data, error } = await supabase
    .from("punch_records")
    .select("*")
    .gte("registrado_em", from.toISOString())
    .lte("registrado_em", to.toISOString())
    .order("registrado_em", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listarPontosEmpresa(companyId: string, from: Date, to: Date, employeeId?: string) {
  let q = supabase
    .from("punch_records")
    .select("*, employees(nome)")
    .eq("company_id", companyId)
    .gte("registrado_em", from.toISOString())
    .lte("registrado_em", to.toISOString())
    .order("registrado_em", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
