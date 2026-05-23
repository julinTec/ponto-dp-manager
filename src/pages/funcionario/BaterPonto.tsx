import { useEffect, useState } from "react";
import { FuncionarioLayout } from "@/components/FuncionarioLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, MapPin, LogIn, Coffee, LogOut as LogOutIcon, RotateCcw, AlertCircle, CheckCircle2, Fingerprint } from "lucide-react";
import { getCurrentPosition, GeolocationError, type GeoPosition } from "@/services/geolocation";
import { getMyEmployeeAndCompany, registrarPonto, type CompanyGeofence, type PunchType } from "@/services/punch";
import { haversineMeters } from "@/utils/distance";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const BUTTONS: { tipo: PunchType; label: string; icon: any }[] = [
  { tipo: "entrada", label: "Entrada", icon: LogIn },
  { tipo: "saida_intervalo", label: "Saída intervalo", icon: Coffee },
  { tipo: "retorno_intervalo", label: "Retorno intervalo", icon: RotateCcw },
  { tipo: "saida_final", label: "Saída final", icon: LogOutIcon },
];

const NEXT_TIPO: Record<string, PunchType> = {
  none: "entrada",
  entrada: "saida_intervalo",
  saida_intervalo: "retorno_intervalo",
  retorno_intervalo: "saida_final",
  saida_final: "entrada",
};

export default function BaterPonto() {
  const [loadingPos, setLoadingPos] = useState(true);
  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyGeofence | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<PunchType | null>(null);
  const [todayPunches, setTodayPunches] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { company } = await getMyEmployeeAndCompany();
        setCompany(company);
      } catch (e: any) {
        setCompanyError(e.message);
      }
      await refreshPosition();
      await loadToday();
    })();
  }, []);

  async function refreshPosition() {
    setLoadingPos(true);
    setGeoError(null);
    try {
      const p = await getCurrentPosition();
      setPos(p);
    } catch (e) {
      const err = e as GeolocationError;
      setGeoError(err.message);
    } finally {
      setLoadingPos(false);
    }
  }

  async function loadToday() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("punch_records").select("*")
      .eq("user_id", u.user.id)
      .gte("registrado_em", start.toISOString())
      .lte("registrado_em", end.toISOString())
      .order("registrado_em", { ascending: false });
    setTodayPunches(data ?? []);
  }

  async function handlePunch(tipo: PunchType) {
    setSubmitting(tipo);
    try {
      const res = await registrarPonto(tipo);
      toast.success(`Ponto registrado a ${Math.round(res.distancia_metros)} m da empresa`);
      await loadToday();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao registrar ponto");
    } finally {
      setSubmitting(null);
    }
  }

  const distancia =
    pos && company?.latitude != null && company?.longitude != null
      ? haversineMeters({ lat: pos.lat, lng: pos.lng }, { lat: Number(company.latitude), lng: Number(company.longitude) })
      : null;
  const dentroDoRaio = distancia != null && company ? distancia <= company.raio_ponto_metros : false;

  const lastTipo = (todayPunches[0]?.tipo as string) ?? "none";
  const nextTipo = NEXT_TIPO[lastTipo] ?? "entrada";
  const NextBtn = BUTTONS.find((b) => b.tipo === nextTipo)!;
  const NextIcon = NextBtn.icon;
  const canPunch = !!company && !loadingPos && dentroDoRaio && !submitting;

  return (
    <FuncionarioLayout>
      <div className="space-y-5">
        {/* Hero clock */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-hero text-primary-foreground p-6 shadow-premium">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary-glow/30 blur-3xl" />
          <div className="relative text-center">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/60 font-semibold">
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
            <p className="mt-1 text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
              {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              <span className="text-2xl text-white/60 ml-1">{now.toLocaleTimeString("pt-BR", { second: "2-digit" }).slice(-2)}</span>
            </p>
          </div>
        </section>

        {/* Location card */}
        <div
          className={cn(
            "surface-card p-4 flex items-start gap-3 border-l-4",
            companyError || geoError
              ? "border-l-destructive"
              : dentroDoRaio
                ? "border-l-success"
                : distancia != null
                  ? "border-l-warning"
                  : "border-l-border"
          )}
        >
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              dentroDoRaio ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
            )}
          >
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {loadingPos
                ? "Obtendo localização…"
                : geoError
                  ? "Sem localização"
                  : companyError
                    ? "Empresa não configurada"
                    : dentroDoRaio
                      ? "Dentro da área permitida"
                      : distancia != null
                        ? "Fora da área permitida"
                        : "Aguardando dados"}
            </p>
            {company && distancia != null && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {Math.round(distancia)} m da empresa · limite {company.raio_ponto_metros} m
              </p>
            )}
            {geoError && <p className="text-xs text-destructive mt-0.5">{geoError}</p>}
            {companyError && <p className="text-xs text-destructive mt-0.5">{companyError}</p>}
            {pos && (
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} · ±{Math.round(pos.accuracy)} m
              </p>
            )}
            <Button variant="outline" size="sm" onClick={refreshPosition} className="mt-2 h-7" disabled={loadingPos}>
              Atualizar
            </Button>
          </div>
        </div>

        {/* Big punch button */}
        <div className="flex justify-center py-2">
          <button
            onClick={() => handlePunch(nextTipo)}
            disabled={!canPunch}
            className={cn(
              "group relative h-44 w-44 rounded-full flex flex-col items-center justify-center gap-2 text-primary-foreground font-semibold shadow-premium transition-all",
              "bg-gradient-primary",
              canPunch ? "hover:scale-[1.03] active:scale-[0.98]" : "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="absolute inset-0 rounded-full ring-8 ring-primary/10 group-hover:ring-primary/20 transition-all" />
            {submitting ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <>
                <NextIcon className="h-10 w-10" />
                <span className="text-sm tracking-tight">{NextBtn.label}</span>
              </>
            )}
          </button>
        </div>

        {/* Other actions */}
        <div className="grid grid-cols-2 gap-2">
          {BUTTONS.filter((b) => b.tipo !== nextTipo).map((b) => {
            const Icon = b.icon;
            const disabled = !canPunch;
            return (
              <Button
                key={b.tipo}
                onClick={() => handlePunch(b.tipo)}
                disabled={disabled || submitting === b.tipo}
                variant="outline"
                className="h-14 justify-start gap-2 rounded-xl"
              >
                {submitting === b.tipo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                <span className="text-sm">{b.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Today list */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="section-title">Hoje</h2>
            <span className="text-[11px] text-muted-foreground">{todayPunches.length} registros</span>
          </div>
          {todayPunches.length === 0 ? (
            <div className="surface-card p-6 text-center text-sm text-muted-foreground">
              <Fingerprint className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              Nenhum ponto registrado hoje.
            </div>
          ) : (
            <div className="surface-card divide-y divide-border/70 overflow-hidden">
              {todayPunches.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center",
                      p.dentro_do_raio ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}>
                      {p.dentro_do_raio ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{labelOf(p.tipo)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {p.distancia_metros != null ? `${Math.round(p.distancia_metros)} m` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FuncionarioLayout>
  );
}

function labelOf(t: string) {
  return (
    { entrada: "Entrada", saida_intervalo: "Saída intervalo", retorno_intervalo: "Retorno intervalo", saida_final: "Saída final" } as any
  )[t] ?? t;
}
