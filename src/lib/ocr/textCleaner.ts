// Limpa e normaliza texto bruto de OCR antes de enviar para a IA.
// Remove caracteres de controle, colapsa whitespace, trunca tamanho.

const MAX_CHARS = 12000;

export function cleanOcrText(raw: string): string {
  if (!raw) return "";
  let t = raw.normalize("NFC");
  // remove caracteres de controle exceto \n e \t
  t = t.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  // normaliza quebras de linha
  t = t.replace(/\r\n?/g, "\n");
  // colapsa múltiplas linhas vazias
  t = t.replace(/\n{3,}/g, "\n\n");
  // remove espaços em fim de linha
  t = t.replace(/[ \t]+\n/g, "\n");
  // colapsa múltiplos espaços
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.trim();
  if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS) + "\n…[truncado]";
  return t;
}

export function detectLanguageHint(text: string): "por" | "eng" | "mixed" {
  const lower = text.toLowerCase();
  const ptHits = (lower.match(/\b(cpf|rg|nome|nascimento|endereço|endereco|carteira|trabalho|residência|certidão|admissão|salário|brasil)\b/g) || []).length;
  const enHits = (lower.match(/\b(name|date of birth|address|employee|signature|country)\b/g) || []).length;
  if (ptHits > enHits * 2) return "por";
  if (enHits > ptHits * 2) return "eng";
  return "mixed";
}
