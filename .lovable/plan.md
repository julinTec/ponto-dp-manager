## Repaginação Visual Premium — Sistema DP

Vou refazer toda a camada visual mantendo 100% das rotas, fluxos e regras de negócio intocadas. Trabalho apenas em CSS, layout, componentes de apresentação e ajustes de classes nas páginas.

### 1. Design system (base de tudo)

Reescrever `src/index.css` e `tailwind.config.ts` com a paleta solicitada (em HSL):

- `--background` #F6F7FB · `--card` #FFFFFF · `--foreground` #0F172A · `--muted-foreground` #64748B
- `--primary` #2563EB · `--accent` (premium) #10B981 · `--destructive` #EF4444 · `--warning` #F59E0B · `--border` #E2E8F0
- `--sidebar-background` #0F172A com foreground claro, accent #1E293B, ring primary
- Sombras suaves novas: `--shadow-card`, `--shadow-elevated`, `--shadow-premium`
- Gradientes sutis: `--gradient-surface`, `--gradient-primary`, `--gradient-premium`
- Radius padrão `1rem` (cards em `rounded-2xl`)
- Tipografia: importar Inter (variável) via `index.html`, tracking apertado em headings, hierarquia clara (display/h1/h2/body/caption)
- Transições globais (`transition-colors`, `transition-shadow`) e hover states reutilizáveis

### 2. Componentes reutilizáveis (novos / repaginados)

Pasta `src/components/shell/` e `src/components/ui-kit/`:

- `AppShell` — wrapper com sidebar + topbar + área de conteúdo com max-width e padding consistentes
- `Sidebar` — refazer dentro do `AppLayout.tsx` atual: fundo escuro premium, logo no topo, grupos com labels em uppercase suave, item ativo com pílula primária + barra lateral, ícones lucide consistentes, footer com usuário e logout, colapsável para ícones
- `Topbar` — busca global (placeholder por enquanto), seletor de empresa, sininho, avatar com menu
- `PageHeader` (já existe — repaginar): título grande, descrição cinza, breadcrumbs opcional, slot de ações à direita
- `MetricCard` — número grande, label, ícone em chip colorido suave, delta com seta, sparkline opcional (Recharts mini)
- `StatusBadge` (já existe — repaginar): variantes neutro/info/sucesso/aviso/erro/premium com cores suaves de fundo + texto saturado
- `DataTable` — wrapper sobre tabela atual: header sticky, zebra suave, hover, ações em final de linha, paginação, busca e filtros no topo, empty state integrado
- `EmptyState` — ilustração mínima + título + descrição + CTA
- `SectionCard` — card com header (título/descrição) e slot de conteúdo, usado em formulários agrupados
- `ActionButton` — variantes primary/secondary/ghost/danger/premium com loading e ícone
- `EmployeeCard` — avatar com iniciais, nome, cargo, empresa, badges de status, ações rápidas
- `Timeline` — lista vertical de eventos com ponto colorido por tipo, hora relativa, descrição

### 3. Páginas — aplicar o novo padrão

Sem mexer em lógica, apenas em JSX/classes:

- **Dashboard** (`Dashboard.tsx`): grid de `MetricCard` (Funcionários ativos, Admissões em andamento, Pontos pendentes, Atestados do mês, Horas extras, Alertas de fechamento), gráfico simples (Recharts area/bar) de horas no mês, painel "Atividades recentes" usando `Timeline`
- **Funcionários** (`Funcionarios.tsx`): toolbar de filtros + `DataTable` modernizada + opção de alternar para grid de `EmployeeCard`
- **Ficha do Funcionário** (`FichaFuncionario.tsx`): header CRM com avatar, nome, cargo, empresa, status e ações; faixa de cards com dados-chave; abas (Cadastrais, Contrato, Documentos, Ponto, Ocorrências, Histórico); coluna direita com `Timeline` de eventos; badges para atestado/advertência/suspensão/pendências
- **Admissões** (`Admissoes.tsx`, `AdmissaoDetalhe.tsx`): área drag-and-drop estilizada, status da IA em chip animado, checklist de documentos, dados extraídos em `SectionCard`s, botão "Aprovar admissão" em destaque premium
- **Ponto do funcionário** (`src/pages/funcionario/*`): mobile-first, botão circular grande centralizado, card de localização com estado "Dentro da área" (verde) / "Fora da área" (vermelho), histórico do dia logo abaixo, visual confiável
- **Aprovações, Fechamento Mensal, Documentos, Relatórios, Usuários, Lotes, Revisão, SuperAdmin, Auth**: aplicar `PageHeader`, `SectionCard`, `DataTable`, `StatusBadge` e novos espaçamentos. Tela de Auth com split-screen premium (gradiente sutil à esquerda + form à direita)
- **FuncionarioLayout** (bottom nav mobile): repaginar com ícones maiores, item ativo destacado em pílula primária, safe-area

### 4. Responsividade

- Breakpoints revisados em sidebar (off-canvas < lg), topbar (busca colapsa em ícone < md), grids de métricas (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`), tabelas com scroll horizontal + cards alternativos em mobile

### 5. Efeitos e microinterações

- Hover lift suave em cards (`hover:shadow-elevated transition-shadow`), botões com `active:scale-[0.98]`, fade-in nas páginas, skeletons modernos em loading

### Detalhes técnicos

- Apenas `index.css`, `tailwind.config.ts`, componentes em `src/components/**` e JSX das páginas em `src/pages/**` são tocados
- Nenhuma rota, hook, serviço, edge function, migração ou chamada Supabase é alterada
- Recharts já está no projeto (usado para o gráfico do Dashboard); lucide-react para todos os ícones
- Trabalho entregue em ondas para manter qualidade: (1) design tokens + Sidebar/Topbar/PageHeader/MetricCard/StatusBadge, (2) Dashboard + Funcionários + Ficha, (3) Admissões + Ponto + Aprovações + Fechamento, (4) demais páginas + polimento mobile

### Fora do escopo

- Não altero schema, RLS, funções, lógica de negócio, validações, OCR ou cálculos
- Não removo nem renomeio rotas/menus existentes (Lotes continua oculto como já está)
- Não adiciono novas features funcionais
