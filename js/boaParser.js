/**
 * Parser opcional do Boletim de Orientação Acadêmica (BOA).
 *
 * Extrai o currículo recomendado e as disciplinas já aprovadas/equivalentes,
 * permitindo sugerir disciplinas pendentes para o simulador.
 */

const CODIGO_REGEX = /([A-Z]{2,}\d+[A-Z]?\d*)/;

/**
 * Extrai texto de um arquivo PDF usando pdfjs-dist.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @returns {Promise<string[]>}
 */
export async function extractBOAText(pdfData) {
  if (!window.pdfjsLib) {
    throw new Error('pdf.js não está disponível.');
  }

  const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
  const lines = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const linhasPagina = agruparItensPorLinha(textContent.items);
    lines.push(...linhasPagina.map((l) => l.trim()).filter(Boolean));
  }

  return lines;
}

function agruparItensPorLinha(items) {
  const TOLERANCIA_Y = 2;
  const grupos = [];

  for (const item of items) {
    if (!item.str || item.str.trim() === '') continue;

    const y = Math.round(item.transform[5] / TOLERANCIA_Y) * TOLERANCIA_Y;
    let grupo = grupos.find((g) => Math.abs(g.y - y) <= TOLERANCIA_Y);

    if (!grupo) {
      grupo = { y, items: [] };
      grupos.push(grupo);
    }

    grupo.items.push(item);
  }

  return grupos
    .sort((a, b) => b.y - a.y)
    .map((g) =>
      g.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item) => item.str)
        .join(' ')
    );
}

function detectarStatus(line) {
  const lower = line.toLowerCase();

  if (lower.includes('inscrição vedada')) return 'inscricao_vedada';
  if (lower.includes('inscrição facultada')) return 'inscricao_facultada';
  if (lower.includes('cursando')) return 'cursando';

  // Procura por uma nota de aprovação isolada (>= 5 e <= 10) ao lado de um código.
  const notas = line.match(/\b(\d+(?:\.\d)?)\b/g)?.map(Number) ?? [];
  const temNotaAprovacao = notas.some((n) => n >= 5 && n <= 10);
  return temNotaAprovacao ? 'aprovada' : 'pendente';
}

/**
 * Tenta extrair uma disciplina de uma linha do BOA.
 * @param {string} line
 * @returns {object|null}
 */
export function parseBOALine(line) {
  if (!line || line.length < 8) return null;

  const codigoMatch = line.match(CODIGO_REGEX);
  if (!codigoMatch) return null;

  const codigo = codigoMatch[1];
  const idxCodigo = line.indexOf(codigo);

  // Créditos: número decimal (ex: 4.0) colado logo antes do código.
  const creditosMatch = line.slice(0, idxCodigo).match(/(\d+\.\d)\s*$/);
  const crR = creditosMatch ? parseFloat(creditosMatch[1]) : 4;

  // Nome: texto entre início e os créditos, removendo CH e período.
  const prefixo = line.slice(0, idxCodigo).replace(/\s*\d+\.\d\s*$/, '').trim();
  const nome = prefixo.replace(/^\d+\s+\d+\s*/, '').trim();

  // Período recomendado: segundo número isolado no início da linha (ex: "60 1").
  const periodoMatch = prefixo.match(/^(\d+)\s+(\d+)/);
  const periodoRecomendado = periodoMatch ? parseInt(periodoMatch[2], 10) : null;

  return {
    codigo,
    nome: nome || codigo,
    crR,
    periodoRecomendado,
    status: detectarStatus(line),
  };
}

/**
 * Parser principal do BOA.
 * @param {string[]} lines
 * @returns {{obrigatorias: Array<object>, optativas: Array<object>}}
 */
export function parseBOA(lines) {
  const obrigatorias = [];
  const optativas = [];

  let emOptativas = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes('atividades acadêmicas optativas')) {
      emOptativas = true;
      continue;
    }

    if (lower.includes('falta cumprir') || lower.includes('já cumpridos')) {
      emOptativas = false;
      continue;
    }

    const disciplina = parseBOALine(line);
    if (disciplina) {
      if (emOptativas) {
        optativas.push(disciplina);
      } else {
        obrigatorias.push(disciplina);
      }
    }
  }

  return { obrigatorias, optativas };
}

/**
 * Processa um arquivo BOA e retorna o currículo estruturado.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @returns {Promise<{obrigatorias: Array<object>, optativas: Array<object>}>}
 */
export async function processarBOA(pdfData) {
  const lines = await extractBOAText(pdfData);
  return parseBOA(lines);
}
