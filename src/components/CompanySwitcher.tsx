import { Building2 } from "lucide-react";
import { useActiveCompany } from "@/contexts/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CompanySwitcher({ className }: { className?: string }) {
  const { activeCompanyId, setActiveCompanyId, companies, canSwitch, loading } = useActiveCompany();

  if (loading || companies.length === 0) return null;

  // Usuário de uma única empresa: mostra nome estático
  if (!canSwitch) {
    const only = companies[0];
    return (
      <div className={"hidden md:flex items-center gap-2 px-3 h-9 rounded-xl bg-muted/60 text-sm text-foreground " + (className ?? "")}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium truncate max-w-[200px]">{only?.nome ?? "—"}</span>
      </div>
    );
  }

  return (
    <Select value={activeCompanyId ?? undefined} onValueChange={(v) => setActiveCompanyId(v)}>
      <SelectTrigger className={"w-[220px] h-9 " + (className ?? "")}>
        <Building2 className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
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
