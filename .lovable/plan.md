## Remover opções de criar conta na tela de login

A tela `/auth` hoje mostra as abas **Entrar / Criar conta** e o botão **Entrar com Google**. Como agora os usuários são criados exclusivamente pelo admin via página **Usuários**, esses caminhos de auto-cadastro precisam sair.

### Mudanças em `src/pages/Auth.tsx`

1. Remover o bloco `<Tabs>` e usar apenas o formulário de login direto no `<Card>`.
2. Remover a aba "Criar conta" (`TabsContent value="cadastro"`) e a função `handleSignUp` + schema `signUpSchema`.
3. Remover o divisor "ou" e o botão **Entrar com Google** (`handleGoogle`).
4. Remover o `useState` `tab` e imports não usados (`Tabs*`, `lovable`, `signUpSchema`).
5. Adicionar uma linha discreta abaixo do botão Entrar:  
   *"O acesso é criado pelo administrador da sua empresa."*

### Resultado

Tela enxuta apenas com E-mail + Senha + Entrar. Sem Google, sem auto-cadastro. Página Usuários (acessível ao admin logado) continua sendo o único caminho para criar contas.
