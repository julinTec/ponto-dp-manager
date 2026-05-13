// Converte um PDF (File) em uma lista de imagens JPEG (File), uma por página.
// Usa pdfjs-dist com worker via CDN para evitar configuração extra do Vite.
import * as pdfjsLib from "pdfjs-dist";

// Worker via CDN — mesma versão do pacote
// @ts-ignore - prop existente em runtime
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PdfPageImage {
  file: File;            // imagem JPEG da página
  pageNumber: number;    // 1-based
}

/**
 * Renderiza cada página do PDF em um canvas e devolve como File JPEG.
 * scale=2 dá boa qualidade para OCR sem estourar tamanho.
 */
export async function pdfFileToImages(
  pdf: File,
  opts: { scale?: number; quality?: number } = {}
): Promise<PdfPageImage[]> {
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.85;

  const buf = await pdf.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  const out: PdfPageImage[] = [];
  const baseName = pdf.name.replace(/\.pdf$/i, "");

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D indisponível");
      // Fundo branco para PDFs com transparência
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar JPEG"))),
          "image/jpeg",
          quality
        )
      );

      const padded = String(i).padStart(3, "0");
      const file = new File([blob], `${baseName}-pag${padded}.jpg`, {
        type: "image/jpeg",
      });
      out.push({ file, pageNumber: i });

      // libera memória
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return out;
}
