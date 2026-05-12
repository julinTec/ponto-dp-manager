## Contexto

Hoje a tabela `companies` só recebe novas empresas via trigger `handle_new_user` (quando alguém se cadastra). Não há UI para Super Admin criar/editar/desativar empresas manualmente. A página `SuperAdmin.tsx` já lista empresas mas é só leitura.

## Plano

### 1. CRUD de empresas na página `SuperAdmin.tsx`

Transformar a página existente em gestão completa de empresas (apenas Super Admin):

- **Botão "Nova empresa"** no header da página → abre `Dialog` com formulário:
  - `nome` (obrigatório)
  - `cnpj` (opcional, com máscara `00.000.000/0000-00`)
  - `ativo` (default true)
- **Ações por linha** na tabela:
  - **Editar** → mesmo `Dialog` em modo edição (nome, cnpj, ativo)
  - **Ativar/Suspender** → toggle rápido do campo `ativo`
  - **Excluir** → `AlertDialog` de confirmação. Bloqueia exclusão se houver `profiles`, `employees` ou `timesheet_batches` vinculados (checa antes via `count` e mostra toast explicativo).
- Validação: nome mínimo 2 chars; CNPJ, se preenchido, validar formato (14 dígitos) sem checar dígito verificador.
- Após cada operação, recarregar lista e invalidar cache do `CompanyFilter` (expor função `clearCompaniesCache()` no `CompanyFilter.tsx` para forçar refetch nas próximas montagens).

### 2. Invalidar cache do `CompanyFilter`

`src/components/CompanyFilter.tsx` mantém `cache: Company[] | null` em módulo. Adicionar export:
```ts
export function clearCompaniesCache() { cache = null; }
```
Chamar após criar/editar/excluir empresa para que o seletor reflita imediatamente.

### 3. Sem mudanças de banco

Schema da tabela `companies` já cobre tudo (`nome`, `cnpj`, `ativo`, timestamps). RLS já permite Super Admin (`Super admin all companies` policy com `ALL`) — INSERT/UPDATE/DELETE funcionam sem migração.

### 4. Acesso

Item "Super Admin" no menu lateral já existe e leva para `/super-admin`. Mantém-se restrito por `isSuperAdmin` + `<Navigate>`.

## Arquivos afetados

**Editados**
- `src/pages/SuperAdmin.tsx` — adicionar formulário (Dialog), ações por linha, AlertDialog de exclusão, validação e checagem de vínculos antes de deletar.
- `src/components/CompanyFilter.tsx` — exportar `clearCompaniesCache()`.

Sem migrations. Sem alteração em edge functions. Sem mudança no fluxo de signup (continua criando empresa "fantasma" para novos cadastros, que o Super Admin pode renomear/mesclar manualmente depois).
