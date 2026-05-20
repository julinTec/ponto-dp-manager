import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'Endereço inválido (mínimo 5 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address.trim());
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'br');

    const resp = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ponto-dp-manager/1.0 (lovable)',
        'Accept-Language': 'pt-BR',
      },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: `Geocoding falhou (${resp.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'not_found', message: 'Endereço não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const first = data[0];
    return new Response(
      JSON.stringify({
        lat: Number(first.lat),
        lng: Number(first.lon),
        display_name: first.display_name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
