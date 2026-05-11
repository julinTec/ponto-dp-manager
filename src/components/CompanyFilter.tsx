import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Company {
  id: string;
  nome: string;
}

// cache simples para não refazer fetch a cada montagem
let cache: Company[] | null = null;
let inFlight: Promise<Company[]> | null = null;

async function fetchCompanies(): Promise<Company[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = supabase
    .from("companies")
    .select("id, nome")
    .order("nome")
    .then(({ data }) => {
      cache = (data ?? []) as Company[];
      inFlight = null;
      return cache;
    });
  return inFlight;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  placeholder?: string;
}

const ALL = "__all__";

export function CompanyFilter({ value, onChange, className, placeholder = "Todas as empresas" }: Props) {
  const { isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(cache ?? []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchCompanies().then(setCompanies);
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger className={className ?? "w-60"}>
        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Seletor obrigatório de empresa (para criação) — só renderiza para Super Admin.
 * Para usuários comuns, retorna null.
 */
export function CompanyPicker({ value, onChange, className }: { value: string | null; onChange: (id: string) => void; className?: string }) {
  const { isSuperAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(cache ?? []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchCompanies().then(setCompanies);
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Selecione a empresa" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
