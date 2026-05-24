// OCR no navegador usando Tesseract.js + pdf.js.
// Devolve texto bruto + confiança média. NÃO envia imagens para a API.
import Tesseract from "tesseract.js";
import { pdfFileToImages } from "@/lib/pdfToImages";

export interface OcrResult {
  text: string;
  confidence: number; // 0..1
  pages: number;
  source: "pdf-text" | "tesseract";
}

/** Tenta extrair texto nativo de um PDF; retorna null se não houver texto significativo. */
async function tryExtractPdfText(file: File): Promise<string | null> {
  try {
    const pdfjsLib: any = await import("pdfjs-dist");
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    let all = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const pageText = tc.items.map((it: any) => it.str).join(" ");
      all += pageText + "\n\n";
      page.cleanup();
    }
    await doc.destroy();
    const trimmed = all.trim();
    // heurística: se vier muito pouco texto, é PDF escaneado
    if (trimmed.length < 40) return null;
    return trimmed;
  } catch (e) {
    console.warn("pdf text extract failed", e);
    return null;
  }
}

async function ocrImageFile(file: File | Blob, lang = "por+eng"): Promise<{ text: string; confidence: number }> {
  const res = await Tesseract.recognize(file, lang);
  const conf = (res.data?.confidence ?? 0) / 100;
  return { text: res.data?.text ?? "", confidence: Math.max(0, Math.min(1, conf)) };
}

/** OCR completo de um documento (PDF ou imagem). */
export async function ocrDocument(file: File, onProgress?: (pct: number) => void): Promise<OcrResult> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  if (isPdf) {
    onProgress?.(5);
    const nativeText = await tryExtractPdfText(file);
    if (nativeText) {
      onProgress?.(100);
      return { text: nativeText, confidence: 0.99, pages: 1, source: "pdf-text" };
    }
    // PDF escaneado → renderiza páginas e OCR
    onProgress?.(15);
    const images = await pdfFileToImages(file, { scale: 2 });
    let combined = "";
    let confSum = 0;
    for (let i = 0; i < images.length; i++) {
      const { text, confidence } = await ocrImageFile(images[i].file);
      combined += `\n\n--- Página ${images[i].pageNumber} ---\n${text}`;
      confSum += confidence;
      onProgress?.(15 + Math.round(((i + 1) / images.length) * 80));
    }
    return {
      text: combined.trim(),
      confidence: images.length ? confSum / images.length : 0,
      pages: images.length,
      source: "tesseract",
    };
  }

  // imagem direta
  onProgress?.(20);
  const { text, confidence } = await ocrImageFile(file);
  onProgress?.(100);
  return { text, confidence, pages: 1, source: "tesseract" };
}
