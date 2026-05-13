import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function GeminiTest() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ status: number; googleResponse: any } | null>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const text = prompt.trim();
    if (!text) {
      toast({ title: "Prompt vazio", description: "Digite algo antes de enviar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResponse("");
    setErrorDetails(null);
    try {
      const { data, error } = await supabase.functions.invoke("gemini-proxy", {
        body: { prompt: text },
      });
      if (error) throw new Error(error.message);
      if (data?.error) {
        setErrorDetails({ status: data.status ?? 0, googleResponse: data.googleResponse ?? null });
        throw new Error(data.error);
      }
      setResponse(data?.text ?? "(resposta vazia)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Teste Gemini</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escreva seu prompt..."
            rows={6}
            disabled={loading}
          />
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>) : "Enviar"}
          </Button>

          {response && (
            <div className="rounded-md border bg-muted p-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Resposta</p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{response}</pre>
            </div>
          )}

          {errorDetails && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-4">
              <p className="mb-2 text-sm font-semibold text-destructive">
                Erro Gemini — HTTP {errorDetails.status}
              </p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                {JSON.stringify(errorDetails.googleResponse, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
