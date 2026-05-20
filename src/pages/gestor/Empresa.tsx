import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentPosition } from "@/services/geolocation";
import { Loader2, MapPin } from "lucide-react";

export default function Empresa() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    endereco: "",
    latitude: "",
    longitude: "",
    raio_ponto_metros: "150",
  });

  useEffect(() => {
    if (!profile?.company_id) return;
    (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        setForm({
          nome: data.nome ?? "",
          cnpj: data.cnpj ?? "",
          endereco: data.endereco ?? "",
          latitude: data.latitude?.toString() ?? "",
          longitude: data.longitude?.toString() ?? "",
          raio_ponto_metros: (data.raio_ponto_metros ?? 150).toString(),
        });
      }
      setLoading(false);
    })();
  }, [profile?.company_id]);

  async function useCurrentLocation() {
    try {
      const p = await getCurrentPosition();
      setForm((f) => ({ ...f, latitude: p.lat.toFixed(7), longitude: p.lng.toFixed(7) }));
      toast.success("Localização capturada");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.company_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        nome: form.nome,
        cnpj: form.cnpj || null,
        endereco: form.endereco || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        raio_ponto_metros: Number(form.raio_ponto_metros) || 150,
      })
      .eq("id", profile.company_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Empresa atualizada");
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Empresa" description="Dados da empresa e área permitida para bater ponto" />
      <div className="p-6 max-w-2xl">
        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="raio">Raio permitido (metros)</Label>
                <Input id="raio" type="number" min={10} value={form.raio_ponto_metros} onChange={(e) => setForm({ ...form, raio_ponto_metros: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" type="number" step="0.0000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" type="number" step="0.0000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={useCurrentLocation}>
                <MapPin className="h-4 w-4 mr-2" /> Usar minha localização atual
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
