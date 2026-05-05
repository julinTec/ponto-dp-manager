## Objetivo

1. Promover `juliocezarvieira21@gmail.com` a **super_admin** (hoje você é apenas `admin` da empresa).
2. Criar a página **Usuários** para o admin convidar/gerenciar membros da empresa, com dois perfis claros: **Admin** e **Gerencial**.

---

## 1. Mapeamento de perfis

O enum `app_role` atual é `('super_admin', 'admin', 'revisor')`. Em vez de criar um enum novo (e quebrar o que já existe), faço o mapeamento conceitual:

| Perfil exibido | Role no banco | O que vê |
|---|---|---|
| **Admin** | `admin` | Tudo: Dashboard, Lotes, Funcionários, Relatórios e **Usuários** |
| **Gerencial** | `revisor` | Dashboard, Lotes, Funcionários, Relatórios — **NÃO** vê Usuários nem Super Admin |
| Super Admin | `super_admin` | Tudo + tela global de empresas (você) |

A label "Gerencial" fica só na UI; no banco continua `revisor` para preservar as RLS já existentes.

---

## 2. Promoção a super_admin

Operação direta no banco (insert), sem migration, porque é dado e não schema:

```sql
INSERT INTO public.user_roles (user_id, company_id, role)
VALUES ('09479edd-8bdd-4d2a-bd6a-43bb3f2e49ca', NULL, 'super_admin');
```

Resultado: você passa a ver o item **Super Admin** no menu lateral e mantém o `admin` da sua empresa.

---

## 3. Página "Usuários" (`/usuarios`)

Nova rota protegida visível **apenas para `admin` ou `super_admin`** (a sidebar e a própria página checam — Gerencial recebe redirect para `/`).

### Layout

- Cabeçalho: "Usuários" + botão **"Adicionar usuário"**.
- Tabela: Nome, E-mail, Perfil (badge: Admin / Gerencial), Criado em, Ações (alterar perfil, remover acesso).
- Filtra automaticamente por `company_id = get_user_company(auth.uid())`.

### Adicionar usuário (modal)

Campos: Nome, E-mail, Senha temporária, Perfil (Admin / Gerencial).

Como criar um usuário sem deslogar o admin atual? Uso uma **edge function `admin-create-user`** que:

1. Valida que quem chama é `admin` da empresa (ou `super_admin`).
2. Cria o usuário via `supabase.auth.admin.createUser` (service role, `email_confirm: true`).
3. Sobrescreve o `profile.company_id` para a mesma `company_id` do admin (o trigger `handle_new_user` cria uma empresa nova por padrão — preciso ajustar isso para o novo usuário).
4. Remove o role `admin` que o trigger criou e insere o role escolhido (`admin` ou `revisor`) com a `company_id` correta.
5. Remove a empresa "fantasma" criada pelo trigger.

### Alterar perfil / remover acesso

- Alterar perfil: `UPDATE user_roles SET role = ... WHERE user_id = ? AND company_id = ?` (já permitido pela RLS atual "Admins manage roles in own company").
- Remover acesso: `DELETE FROM user_roles` para o user na company. (O usuário continua existindo no auth, só perde acesso à empresa.)

---

## 4. Sidebar (`AppLayout.tsx`)

Adicionar item "Usuários" (ícone `UserCog`) visível somente quando `isAdmin || isSuperAdmin`.

---

## 5. Arquivos a criar / editar

**Criar**
- `src/pages/Usuarios.tsx` — listagem + modal de criação + ações.
- `supabase/functions/admin-create-user/index.ts` — criação segura de usuário com role.

**Editar**
- `src/App.tsx` — registrar rota `/usuarios` protegida.
- `src/components/AppLayout.tsx` — item de menu "Usuários" condicional.
- `supabase/config.toml` — registrar a nova função (verify_jwt padrão = true, pois precisamos do JWT do admin chamador).

**Operação de dados (sem migration)**
- INSERT em `user_roles` para te promover a `super_admin`.

---

## Detalhes técnicos relevantes

- **Segurança da edge function**: a função extrai o JWT do header `Authorization`, chama `getUser()` com client anon, depois usa o **service role** apenas para criar o usuário. Antes de criar, valida `has_role(caller, 'admin')` na company alvo via `read_query`.
- **Trigger `handle_new_user`**: continua intacto. A função compensa o efeito dele (apaga a company fantasma e reaponta o profile/role).
- **Label "Gerencial"**: helpers `roleLabel(role)` e `roleFromLabel(label)` para conversão consistente UI ↔ banco.
- **Sem novas tabelas, sem novo enum, sem mudanças de RLS** — tudo já está coberto pelas policies existentes.
