## Diagnóstico

O toast vermelho **"Erro ao carregar documentos"** aparece porque a página `/documentos` faz:

```ts
supabase.from("employee_documents").select("*, employees(id, nome, cpf)")
```

Mas a tabela `public.employee_documents` **não possui foreign key** ligando `employee_id` → `employees(id)`. Sem essa FK, o PostgREST não consegue resolver o embed `employees(...)` e retorna o erro `PGRST200` ("Could not find a relationship between 'employee_documents' and 'employees'"). O `catch` exibe o toast e a lista volta vazia (por isso "0 documento(s)").

Verifiquei via SQL:
- `employee_documents.employee_id` existe (uuid), mas `pg_constraint` não tem nenhuma FK na tabela.
- O mesmo problema provavelmente afeta `admission_documents` e `payroll_adjustments`, que também referenciam `employees`/`employee_admissions` sem FK explícita.

## Correção

Migração SQL adicionando as foreign keys faltantes (com `ON DELETE` apropriado, sem mexer em dados existentes):

1. `employee_documents.employee_id` → `employees(id) ON DELETE SET NULL`
2. `employee_documents.company_id` → `companies(id) ON DELETE CASCADE`
3. `admission_documents.admission_id` → `employee_admissions(id) ON DELETE CASCADE` (se faltar)
4. `payroll_adjustments.employee_id` → `employees(id) ON DELETE CASCADE` (se faltar)

Antes de criar cada FK, vou conferir se já existe e se há linhas órfãs (employee_id apontando para id inexistente) — se houver, limpo com `UPDATE ... SET employee_id = NULL` para não quebrar a migração.

Após aplicar, o embed `employees(id, nome, cpf)` passa a funcionar e a página `/documentos` carrega normalmente. Nenhuma alteração de código frontend é necessária.

## Arquivos

- Nova migração em `supabase/migrations/` adicionando as FKs.
- Sem alterações em código TS/React.
