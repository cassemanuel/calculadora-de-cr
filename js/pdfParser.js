/**
 * Parser de PDFs do SIGA/UFRJ (boletim/histórico).
 */

/**
 * Extrai texto de um arquivo PDF.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<string[]>}
 */
export async function extractTextFromPDF(pdfData, onProgress) {
  if (!window.pdfjsLib) {
    throw new Error('pdfjs-dist não está disponível.');
  }

  const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
  const lines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    lines.push(...pageText.split('\n').filter(Boolean));

    if (onProgress) {
      onProgress(i / pdf.numPages);
    }
  }

  return lines;
}

/**
 * Parser principal: transforma as linhas do PDF em objeto estruturado.
 * @param {string[]} lines
 * @returns {object}
 */
export function parseHistorico(lines) {
  // TODO: implementar na Etapa 3
  return { metadata: {}, periodos: [], resumo: {} };
}
