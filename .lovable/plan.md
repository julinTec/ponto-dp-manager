## Objetivo
Adicionar um novo secret chamado `GEMINI_API_KEY` ao projeto.

## Contexto
O projeto já possui o secret `GOOGLE_GEMINI_API_KEY`, mas o usuário precisa de um novo secret com o nome `GEMINI_API_KEY` (possivelmente para uso em outro contexto ou com uma chave diferente).

## Passo
1. Solicitar ao usuário o valor do secret `GEMINI_API_KEY` via formulário seguro do Lovable.
2. O secret será armazenado como variável de ambiente e estará disponível nas edge functions e código backend.

## Observação
Nenhuma alteração de código ou arquivo do projeto é necessária para esta tarefa — apenas a configuração do secret no painel de secrets do Lovable.