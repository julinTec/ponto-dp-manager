## Problema identificado
O erro real não está no modelo em si.

- O lote atual falhou em `ocr-page` com `ai-document-reader 400`.
- O `ai-document-reader` tentou a rota `pdf` com `google/gemma-4-31b-it:free` e fallback `openai/gpt-oss-120b:free`.
- Ambos falharam com a mesma resposta do OpenRouter: `Failed to parse ...pdf`.
- Isso indica falha no pré-processamento do PDF, antes da inferência do modelo; portanto, adicionar “um terceiro modelo free” para PDF não resolve esse caso.
- Além disso, a tela de revisão hoje tenta renderizar o arquivo com `<img>`, então quando a página é um PDF ela pode ficar sem prévia visual.

## Solução proposta
Trocar a estratégia de PDF no fluxo de lotes:

1. Converter PDFs em imagens por página no upload
   - Quando o usuário subir um PDF em **Novo Lote**, o app converte cada página em PNG/JPG.
   - Cada página convertida passa a entrar no fluxo como imagem normal.
   - Assim, o OCR usa a rota de visão que já funciona com modelos free.

2. Ajustar o processamento do lote para múltiplas páginas reais
   - O fluxo deixará de assumir “1 arquivo = 1 página”.
   - PDFs passam a gerar várias páginas derivadas, cada uma com sua imagem própria.
   - Imagens comuns continuam com o comportamento atual.

3. Corrigir a tela de revisão
   - A revisão passa a exibir corretamente páginas de lote convertidas em imagem.
   - Se existir algum item antigo em PDF bruto, a interface mostrará estado/erro claro em vez de ficar “em branco”.

4. Fortalecer mensagens de erro e rastreio
   - Registrar claramente quando o PDF falhar por parsing externo.
   - Exibir feedback útil para o usuário em vez de parecer que “não surgiu nada”.

## Arquivos que pretendo ajustar
- `src/pages/NovoLote.tsx`
- `src/pages/Revisao.tsx`
- `supabase/functions/process-batch/index.ts`
- `supabase/functions/ocr-page/index.ts`
- `supabase/functions/ai-document-reader/index.ts`
- possivelmente `package.json` para adicionar a biblioteca de renderização de PDF no cliente

## Detalhes técnicos
- Usarei uma biblioteca de PDF no frontend para renderizar cada página em canvas e exportar imagem.
- O OCR continuará centralizado no fluxo atual, mas receberá imagens em vez de PDF bruto para lotes.
- Vou preservar o comportamento de imagens simples e refatorar apenas o necessário para PDFs.
- Também vou manter compatibilidade com os dados atuais, tratando lotes antigos com mensagem adequada quando o arquivo original ainda for PDF bruto.

## Resultado esperado
Depois da implementação:

- subir PDF em **Lotes** passa a gerar páginas visíveis na revisão;
- o OCR deixa de depender do parser grátis de PDF do OpenRouter para esse fluxo;
- o sistema volta a extrair dados usando os modelos free já configurados para imagem;
- o usuário não fica mais sem retorno visual quando o arquivo for PDF.