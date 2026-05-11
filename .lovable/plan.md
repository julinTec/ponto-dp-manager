## Contexto

Hoje cada usuário pertence a UMA empresa via `profiles.company_id`, e o RLS já isola dados por empresa. Super Admin vê tudo agregado mas sem filtro na UI.

Decisões confirmadas:
1. Apenas Super Admin precisa filtrar entre empresas (usuários comuns continuam restritos pelo RLS).
2. Filtro **por página** (não global) — cada tela tem seu próprio seletor local.
3. No upload de lote, Super Admin escolhe explicitamente a empresa. A IA não detecta empresa do cabeçalho.

## Plano

### 1. Componente reutilizável `CompanyFilter`

Criar `src/components/CompanyFilter.tsx`:
- Props: `value: string | null`, `onChange: (id: string | null) => void`, `className?`.
- Renderiza apenas se `useAuth().isSuperAdmin === true` (caso contrário, retorna `null`).
- Internamente busca a lista de empresas (`supabase.from("companies").select("id, nome").order("nome")`) com cache simples via `useState` + `useEffect` (uma vez por montagem).
- UI: `<Select>` shadcn com ícone `Building2`, opção "Todas as empresas" (value vazio) + uma opção por empresa.
- Largura fixa (~240px), alinhado à direita do header da página.

### 2. Aplicar em cada página listada

Em cada página, adicionar:
```tsx
const { isSuperAdmin } = useAuth();
const [companyFilter, setCompanyFilter] = useState<string | null>(null);
// ... no JSX do header da página:
<CompanyFilter value={companyFilter} onChange={setCompanyFilter} />
```

E nas queries, quando `companyFilter` for não-nulo, aplicar `.eq("company_id", companyFilter)`. Para usuários não-super_admin, o filtro nem aparece e o RLS continua isolando por empresa naturalmente.

| Página | Tabelas a filtrar |
|---|---|
| Dashboard | `timesheet_batches`, `employees`, `employee_documents`, `time_entries` (via `batch_id in batches.company_id`), `payroll_adjustments` |
| Lotes | `timesheet_batches` |
| Admissões | `employee_admissions` |
| Funcionários | `employees` |
| Documentos | `employee_documents` |
| Relatórios | filtros existentes + `company_id` opcional |

Cada página mantém seu próprio estado — trocar empresa em "Lotes" não afeta "Funcionários".

### 3. Seletor de empresa nos formulários de criação (Super Admin)

Quando Super Admin cria algo que precisa de `company_id`, exibir um `<Select>` obrigatório de empresa antes de inserir:
- `src/pages/NovoLote.tsx` — empresa do lote
- formulário de novo funcionário em `Funcionarios.tsx`
- formulário de nova admissão em `Admissoes.tsx`
- formulário de novo documento em `Documentos.tsx`

Para usuários comuns: nada muda, usa `profile.company_id` automaticamente.

### 4. Sem mudanças de banco / IA

- Nenhuma migration. Schema já é multi-empresa.
- `process-batch` e demais edge functions continuam usando o `company_id` do lote (vindo do upload). Funcionários criados durante o OCR herdam esse `company_id`. Nenhuma alteração na lógica de IA.

## Arquivos afetados

**Novos**
- `src/components/CompanyFilter.tsx`

**Editados (filtro de listagem)**
- `src/pages/Dashboard.tsx`
- `src/pages/Lotes.tsx`
- `src/pages/Admissoes.tsx`
- `src/pages/Funcionarios.tsx`
- `src/pages/Documentos.tsx`
- `src/pages/Relatorios.tsx`

**Editados (seletor de empresa em criação para Super Admin)**
- `src/pages/NovoLote.tsx`
- formulários em `Funcionarios.tsx`, `Admissoes.tsx`, `Documentos.tsx` (já listados acima)

Sem migrations. Sem alteração em edge functions. RLS atual permanece intacto.