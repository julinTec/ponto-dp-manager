
# Plano: gestão de Funcionários na página Usuários

## Visão geral

Hoje `/usuarios` cria apenas **Admin** e **Gerencial**. Vamos transformá-la em hub único de acessos da empresa, adicionando uma aba **Funcionários** que cria o login do colaborador (perfil `funcionario`) com senha temporária. Esse usuário, ao logar em `/auth`, já é redirecionado automaticamente para `/ponto` (rota já existente).

Toda a lógica de criação continua passando pelo edge function `admin-create-user`, que será estendido para aceitar o novo perfil.

## Estrutura final da página

```text
/usuarios
 ├── Aba "Equipe interna"   → comportamento atual (Admin/Gerencial)
 └── Aba "Funcionários"     → nova
      ├── Tabela: Nome | Cargo | Jornada | Email | Último ponto | Ações
      └── Botão "Adicionar funcionário" → Dialog com 2 modos:
           ◦ Vincular funcionário existente (select dos employees sem user_id)
           ◦ Criar funcionário novo (nome, cpf, cargo, jornada, email, senha)
```

## Mudanças por arquivo

### 1. `supabase/functions/admin-create-user/index.ts`
Aceitar novo payload:
- `role: "admin" | "revisor" | "funcionario"`
- Quando `role = funcionario`, campos extras:
  - `employee_id?: string` (vincular a um employee existente) **ou**
  - `employee_data?: { nome, cpf?, cargo?, jornada_padrao_horas? }` (criar novo)
- Fluxo:
  1. Valida que o caller é admin da empresa (já existe).
  2. Cria auth user (já existe).
  3. Reaponta profile para a empresa do caller, apaga company fantasma (já existe).
  4. Insere `user_roles` com `role = funcionario` em vez de admin/revisor.
  5. Se `employee_id` veio: `UPDATE employees SET user_id = newUserId, email = email WHERE id = employee_id AND company_id = caller.company`.
  6. Se `employee_data` veio: `INSERT INTO employees (company_id, user_id, nome, cpf, cargo, jornada_padrao_horas, email)`.
- Retorna `{ ok, user_id, employee_id }`.

### 2. `src/pages/Usuarios.tsx`
- Envolver conteúdo em `<Tabs>` com `equipe` e `funcionarios`.
- A aba `equipe` mantém exatamente o que já existe (não quebra nada).
- A aba `funcionarios`:
  - Query 1: `user_roles` com `role=funcionario` da empresa.
  - Query 2: `employees` da empresa com `user_id IS NOT NULL` (para cargo/jornada).
  - Query 3 (opcional, mesma view): último `punch_records.registrado_em` por `user_id`.
  - Renderiza tabela própria.
  - Botão **Adicionar funcionário** abre um Dialog separado (`AddFuncionarioDialog`).

### 3. Novo: `src/components/AddFuncionarioDialog.tsx`
- Tabs internas **"Vincular existente"** | **"Criar novo"**.
- **Vincular existente**: select com employees da empresa onde `user_id IS NULL`; campos email + senha temporária; ao salvar chama `admin-create-user` com `employee_id`.
- **Criar novo**: campos nome, cpf (opcional), cargo, jornada (default 8), email, senha; chama `admin-create-user` com `employee_data`.
- Ao sucesso: mostra modal de confirmação com **email + senha + link** (`window.location.origin/auth`) e botão "Copiar instruções" — gestor envia manualmente ao funcionário (WhatsApp, etc.).

### 4. `src/pages/Auth.tsx` (verificar — possivelmente já feito)
- Após login, se único papel for `funcionario`, redirecionar para `/ponto`. Se a lógica ainda não existir nesse arquivo, ajustar.

### 5. `src/App.tsx`
- Sem mudanças. Rotas `/ponto` e `/meu-historico` já existem com guard `funcionario`.

## Banco de dados

Nenhuma migração nova é necessária:
- `employees.user_id` já existe.
- `user_roles` já suporta `role = 'funcionario'`.
- `punch_records` já está pronto.

## Pontos de atenção

- O trigger `handle_new_user` cria automaticamente uma empresa-fantasma + role `admin` para todo novo signup. O edge function já lida com isso (apaga fantasma, reatribui company). Apenas garantir que a parte de "apagar role auto-criado e inserir o role escolhido" trate o caso `funcionario`.
- Validar no edge function que `employee_id` informado pertence à empresa do caller (anti-IDOR).
- Validar que o employee escolhido ainda não tem `user_id` (evita sobrescrever vínculo).
- Email do funcionário precisa ser único no auth — se já existir, retornar erro amigável.

## O que NÃO está no escopo

- Envio automático de email com credenciais (você optou por senha temporária manual).
- Magic link / link compartilhável.
- Edição de cargo/jornada pela própria página Usuários (continua sendo feito em `/funcionarios`).
- Alteração visual da área do funcionário (`/ponto`, `/meu-historico`).
