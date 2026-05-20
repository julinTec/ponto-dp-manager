# Sistema de Ponto por Geolocalização

Expansão do projeto atual (folha de ponto via OCR) com um novo módulo de batida de ponto em tempo real, separando claramente a área do **Gestor** e a área do **Funcionário**. Nenhuma funcionalidade existente é removida.

## 1. Banco de dados (Supabase)

### Alterações em `companies`
Adicionar colunas:
- `endereco text`
- `latitude numeric(10,7)`
- `longitude numeric(10,7)`
- `raio_ponto_metros integer default 150`

### Novo enum em `app_role`
- adicionar valor `funcionario` ao enum existente

### Nova tabela `punch_records`
Campos:
- `id uuid pk`
- `company_id uuid` (FK lógico)
- `employee_id uuid`
- `user_id uuid` (auth.users)
- `tipo text` — `entrada | saida_intervalo | retorno_intervalo | saida_final`
- `registrado_em timestamptz default now()`
- `latitude numeric(10,7)`, `longitude numeric(10,7)`
- `distancia_metros numeric`
- `dentro_do_raio boolean`
- `origem text` — `web | mobile`
- `created_at timestamptz default now()`

RLS:
- Funcionário lê e insere apenas seus próprios registros (`user_id = auth.uid()`)
- Gestor/admin da empresa lê todos os registros da própria empresa
- Super admin lê tudo

### Vínculo funcionário ↔ usuário
Adicionar `employees.user_id uuid` (nullable) para ligar um login ao registro de funcionário. O gestor poderá vincular ao convidar/cadastrar.

## 2. Roles e permissões

- Novo role `funcionario` em `user_roles`.
- Função `has_role` já existente continua válida.
- `ProtectedRoute` ganha prop opcional `allow={['admin','super_admin']}` ou `allow={['funcionario']}`.
- Após login, redirecionamento por role:
  - `super_admin | admin` → `/` (dashboard atual)
  - `funcionario` → `/ponto`

## 3. Rotas e páginas

Estrutura nova (mantendo as atuais intactas):

```text
src/pages/gestor/
  Empresa.tsx           → /gestor/empresa        (endereço, lat/lng, raio)
  Funcionarios.tsx      → /gestor/funcionarios   (wrapper reaproveitando lógica atual + vínculo de user_id)
  RelatoriosPonto.tsx   → /gestor/relatorios-ponto

src/pages/funcionario/
  BaterPonto.tsx        → /ponto
  MeuHistorico.tsx      → /meu-historico
```

As rotas antigas (`/funcionarios`, `/relatorios`, `/lotes`, etc.) continuam funcionando para o gestor.

## 4. Serviços e utilitários

```text
src/services/geolocation.ts
  - getCurrentPosition(): Promise<{lat, lng, accuracy}>
  - watchPosition / clearWatch (opcional)
  - tratamento de permissão negada, timeout, baixa precisão

src/utils/distance.ts
  - haversineMeters(a, b): number
  - isWithinRadius(userPos, companyPos, radiusM): boolean

src/services/punch.ts
  - registrarPonto({tipo}) → busca empresa do funcionário, calcula distância, grava em punch_records
  - listarMeusPontos(periodo)
  - listarPontosEmpresa(filtros) para gestor
```

## 5. Tela `BaterPonto.tsx`

Fluxo:
1. Ao montar, solicita geolocalização (`navigator.geolocation.getCurrentPosition` com `enableHighAccuracy: true`).
2. Mostra status: "Obtendo localização…", erro de permissão, baixa precisão.
3. Busca `latitude/longitude/raio_ponto_metros` da empresa do funcionário.
4. Calcula distância via Haversine e exibe: "Você está a X m da empresa (raio permitido: Y m)".
5. Quatro botões grandes: **Entrada**, **Saída intervalo**, **Retorno intervalo**, **Saída final**.
6. Se `dentro_do_raio === false`: botões desabilitados + mensagem "Você está fora da área autorizada para bater ponto".
7. Sempre grava em `punch_records` mesmo se fora do raio (com `dentro_do_raio = false`) para auditoria — botão fica desabilitado no fluxo normal, mas opcionalmente gestor pode habilitar registros remotos.
8. Confirmação visual + último ponto do dia.

UI mobile-first (cards grandes, fonte legível, tap targets ≥ 48px).

## 6. Tela `MeuHistorico.tsx`
Lista cronológica dos próprios `punch_records` com filtro por mês, mostrando tipo, horário, distância e badge "dentro/fora do raio".

## 7. Tela `gestor/Empresa.tsx`
Formulário com endereço (texto), latitude, longitude, raio (metros).
Botão "Usar minha localização atual" para preencher lat/lng a partir do navegador.
Opcional v2: geocoding via endereço (fora deste plano).

## 8. Tela `gestor/RelatoriosPonto.tsx`
Tabela de `punch_records` filtrada por funcionário, período e status de raio. Exporta CSV.

## 9. Layout / Menu

Atualizar a sidebar para mostrar itens conforme role:

- **Gestor**: itens atuais + grupo "Ponto" → Empresa, Funcionários, Relatórios de Ponto.
- **Funcionário**: somente Bater Ponto e Meu Histórico (sidebar enxuta, layout dedicado mobile-friendly).

## 10. Detalhes técnicos

- React Router já em uso; adicionar guarda por role com hook `useUserRole()` (lê `user_roles`).
- Reutilizar cliente Supabase existente.
- Toda comunicação client-side (sem edge function nesta fase) — Haversine roda no cliente; gravação por insert RLS-protegido.
- Para impedir spoofing trivial, marcar `origem` e `dentro_do_raio` no insert; v2 pode mover validação para edge function que recebe lat/lng e valida server-side antes de gravar (recomendado mais à frente).

## 11. Migração e ordem de execução

1. Migration: enum `funcionario`, colunas em `companies` e `employees.user_id`, tabela `punch_records` + RLS.
2. Utils `distance.ts` + serviço `geolocation.ts` + `punch.ts`.
3. Páginas funcionário (`BaterPonto`, `MeuHistorico`) + rotas + layout mobile.
4. Página gestor `Empresa.tsx` (endereço/raio) e `RelatoriosPonto.tsx`.
5. Atualizar sidebar e redirecionamento por role no login.
6. Vincular funcionário ↔ usuário em `gestor/Funcionarios.tsx`.

## Pontos a confirmar

1. **Como o funcionário entra no sistema?** Convite por e-mail enviado pelo gestor (gera usuário em `auth.users` e role `funcionario` já vinculado ao `employees.id`), ou o gestor cria login/senha manualmente?
2. **Validação server-side da geolocalização agora ou depois?** Posso já criar a edge function `register-punch` para evitar spoofing, ou começar só no cliente?
3. **Raio padrão**: 150 m está bom como default ou prefere outro valor?
4. **Tipos de batida**: confirma os quatro (entrada, saída intervalo, retorno intervalo, saída final) iguais à folha OCR, ou prefere algo livre tipo "entrada/saída" alternando?
