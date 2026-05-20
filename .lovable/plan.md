## Geocoding automático de endereço → lat/lng

Hoje, na tela **Gestor → Empresa**, o gestor precisa digitar latitude e longitude manualmente (ou clicar em "Usar minha localização atual", o que só funciona se ele estiver fisicamente na empresa). Vamos adicionar **geocodificação automática**: o gestor digita o endereço, clica em um botão (ou perde o foco do campo), e o sistema busca lat/lng automaticamente e salva.

### Como vai funcionar

1. Gestor digita o endereço completo no campo "Endereço" (ex: "Av. Paulista, 1000, São Paulo, SP").
2. Clica no botão **"Buscar coordenadas pelo endereço"** ao lado.
3. Sistema chama um serviço de geocoding, retorna lat/lng e preenche os campos automaticamente.
4. Mostra também o endereço normalizado encontrado (ex: "Avenida Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100") para o gestor confirmar que achou o lugar certo.
5. Gestor revisa e clica em **Salvar** — lat/lng ficam gravados em `companies` e o funcionário usa esse ponto fixo para bater ponto.

### Qual serviço de geocoding usar

Tenho duas opções, ambas viáveis. Recomendo a **opção A** para começar (zero configuração, grátis, sem cartão de crédito):

**Opção A — Nominatim (OpenStreetMap) — recomendado**
- 100% grátis, sem chave de API.
- Boa cobertura para endereços brasileiros.
- Limite: 1 requisição por segundo (mais que suficiente — só roda quando o gestor clica no botão).
- Exige enviar um header `User-Agent` identificando o app — por isso a chamada vai por uma edge function (não dá pra chamar direto do browser por causa de CORS + boas práticas).

**Opção B — Google Maps Geocoding API**
- Mais preciso em alguns casos (especialmente endereços ambíguos).
- Exige criar conta no Google Cloud, ativar billing e gerar uma chave de API.
- Tem free tier generoso ($200/mês de crédito), mas requer cartão cadastrado.
- Eu pediria a chave via secret e usaria na mesma edge function.

### Implementação técnica

**1. Edge function `geocode-address`** (`supabase/functions/geocode-address/index.ts`)
- Recebe `{ address: string }`.
- Chama Nominatim: `https://nominatim.openstreetmap.org/search?q=<endereço>&format=json&limit=1&countrycodes=br`.
- Envia `User-Agent: ponto-dp-manager (lovable)` conforme política do Nominatim.
- Retorna `{ lat, lng, display_name }` ou erro `not_found`.
- CORS habilitado, validação Zod do input.

**2. Serviço cliente** (`src/services/geocoding.ts`)
- `geocodeAddress(address): Promise<{lat, lng, displayName}>`.
- Chama a edge function via `supabase.functions.invoke`.

**3. Atualizar `src/pages/gestor/Empresa.tsx`**
- Adicionar botão **"Buscar coordenadas pelo endereço"** ao lado do campo Endereço.
- Ao clicar: chama `geocodeAddress(form.endereco)`, preenche `latitude` e `longitude`, mostra toast com `display_name` para confirmação.
- Manter botão "Usar minha localização atual" como alternativa.
- Mostrar abaixo dos campos lat/lng uma linha discreta "Endereço encontrado: …" quando o geocoding retornar.

### O que NÃO muda

- O fluxo do funcionário (`BaterPonto`) continua igual — ele lê os lat/lng já salvos em `companies` e compara com sua localização atual.
- Schema do banco não muda — as colunas `endereco`, `latitude`, `longitude` já existem.
- Nenhuma funcionalidade existente é removida.

### Confirmação antes de implementar

1. **Qual serviço de geocoding?** Opção A (Nominatim, grátis, sem chave) ou Opção B (Google, mais preciso, exige conta Google Cloud)?
2. **Quando disparar a busca?** Só ao clicar no botão (mais controlado) ou também automaticamente quando o gestor sair do campo "Endereço" (`onBlur`)?
