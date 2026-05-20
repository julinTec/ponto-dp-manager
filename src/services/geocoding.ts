import { supabase } from "@/integrations/supabase/client";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const { data, error } = await supabase.functions.invoke("geocode-address", {
    body: { address },
  });
  if (error) throw new Error(error.message || "Falha ao buscar endereço");
  if (!data || data.error) {
    throw new Error(data?.message || data?.error || "Endereço não encontrado");
  }
  return { lat: data.lat, lng: data.lng, displayName: data.display_name };
}
