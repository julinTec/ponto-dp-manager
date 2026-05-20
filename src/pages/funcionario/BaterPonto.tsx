import { useEffect, useState } from "react";
import { FuncionarioLayout } from "@/components/FuncionarioLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, MapPin, LogIn, Coffee, LogOut as LogOutIcon, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { getCurrentPosition, GeolocationError, type GeoPosition } from "@/services/geolocation";
import { getMyEmployeeAndCompany, registrarPonto, type CompanyGeofence, type PunchType } from "@/services/punch";
import { haversineMeters } from "@/utils/distance";
import { supabase } from "@/integrations/supabase/client";

const BUTTONS: { tipo: PunchType; label: string; icon: any }[] = [
  { tipo: "entrada", label: "Entrada", icon: LogIn },
  { tipo: "saida_intervalo", label: "Saída intervalo", icon: Coffee },
  { tipo: "retorno_intervalo", label: "Retorno intervalo", icon: RotateCcw },
  { tipo: "saida_final", label: "Saída final", icon: LogOutIcon },
];

export default function BaterPonto() {
  const [loadingPos, setLoadingPos] = useState(true);
  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyGeofence | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<PunchType | null>(null);
  const [todayPunches, setTodayPunches] = useState<any[]>([]);

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
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("punch_records")
      .select("*")
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

  return (
    <FuncionarioLayout>
      <h1 className="text-xl font-bold mb-4">Bater ponto</h1>

      <Card className="p-4 mb-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sua localização</p>
            {loadingPos && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Obtendo localização...
              </p>
            )}
            {geoError && <p className="text-xs text-destructive mt-1">{geoError}</p>}
            {pos && (
              <p className="text-xs text-muted-foreground mt-1">
                {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)} (±{Math.round(pos.accuracy)} m)
              </p>
            )}
            <Button variant="outline" size="sm" onClick={refreshPosition} className="mt-2" disabled={loadingPos}>
              Atualizar localização
            </Button>
          </div>
        </div>
      </Card>

      {companyError && (
        <Card className="p-4 mb-4 border-destructive/50">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {companyError}
          </div>
        </Card>
      )}

      {company && (
        <Card className="p-4 mb-4">
          <p className="text-sm font-medium">{company.nome}</p>
          {company.endereco && <p className="text-xs text-muted-foreground">{company.endereco}</p>}
          {company.latitude == null || company.longitude == null ? (
            <p className="text-xs text-destructive mt-2">A empresa ainda não tem localização configurada.</p>
          ) : distancia != null ? (
            <p className={`text-sm mt-2 font-medium ${dentroDoRaio ? "text-green-600" : "text-destructive"}`}>
              {dentroDoRaio ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Dentro do raio permitido ({Math.round(distancia)} m / {company.raio_ponto_metros} m)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Você está a {Math.round(distancia)} m. Limite: {company.raio_ponto_metros} m.
                </span>
              )}
            </p>
          ) : null}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        {BUTTONS.map((b) => {
          const Icon = b.icon;
          const disabled = !dentroDoRaio || !!submitting || !company || loadingPos;
          return (
            <Button
              key={b.tipo}
              onClick={() => handlePunch(b.tipo)}
              disabled={disabled}
              className="h-24 flex flex-col gap-2 text-base"
              variant={b.tipo === "saida_final" ? "destructive" : "default"}
            >
              {submitting === b.tipo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-6 w-6" />}
              {b.label}
            </Button>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold mb-2">Hoje</h2>
      {todayPunches.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum ponto registrado hoje.</p>
      ) : (
        <div className="space-y-2">
          {todayPunches.map((p) => (
            <Card key={p.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{labelOf(p.tipo)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {p.distancia_metros != null ? `${Math.round(p.distancia_metros)} m` : "—"}
                </p>
              </div>
              {p.dentro_do_raio ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </Card>
          ))}
        </div>
      )}
    </FuncionarioLayout>
  );
}

function labelOf(t: string) {
  return (
    { entrada: "Entrada", saida_intervalo: "Saída intervalo", retorno_intervalo: "Retorno intervalo", saida_final: "Saída final" } as any
  )[t] ?? t;
}
