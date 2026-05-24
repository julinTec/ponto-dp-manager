import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CompanyOption {
  id: string;
  nome: string;
}

interface CompanyContextValue {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  companies: CompanyOption[];
  loading: boolean;
  canSwitch: boolean;
}

const STORAGE_KEY = "fluxor.activeCompanyId";

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, profile, isSuperAdmin, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      // RLS já restringe: super admin vê todas; demais vêem só a sua
      const { data } = await supabase.from("companies").select("id, nome").order("nome");
      if (cancelled) return;
      const list = (data ?? []) as CompanyOption[];
      setCompanies(list);

      // Resolver empresa ativa
      const stored = activeCompanyId;
      const validStored = stored && list.some((c) => c.id === stored) ? stored : null;
      const fallback = profile?.company_id ?? list[0]?.id ?? null;
      const next = validStored ?? fallback;
      if (next !== activeCompanyId) setActiveCompanyIdState(next);
      try {
        if (next) localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.company_id, authLoading]);

  function setActiveCompanyId(id: string | null) {
    setActiveCompanyIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  const value = useMemo<CompanyContextValue>(
    () => ({
      activeCompanyId,
      setActiveCompanyId,
      companies,
      loading,
      canSwitch: isSuperAdmin || companies.length > 1,
    }),
    [activeCompanyId, companies, loading, isSuperAdmin]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useActiveCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useActiveCompany must be used inside <CompanyProvider>");
  return ctx;
}
