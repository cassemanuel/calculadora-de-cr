/**
 * Parser opcional do Boletim de Orientação Acadêmica (BOA).
 *
 * Extrai disciplinas pendentes do currículo recomendado para sugerir no simulador.
 */

const CODIGO_UFRJ_REGEX = /([A-Z]{3}\d{3}|[A-Z]{3}[A-Z0-9]\d{2}|[A-Z]{2,}\d+[A-Z]?\d*)/g;
const CREDITOS_REGEX = /(\d+\.\d)/g;
const PENDENTE_TERMS = ['cursando', 'facultada', 'vedada', 'a cursar'];
const IGNORE_TERMS = [
  'pr1', 'boletim', 'orientacao', 'ufrj', 'dre', 'cassio', 'aluno', 'pagina',
  'emissao', 'centro de ciencias', 'instituto de', 'bacharelado', 'integral',
  'unidade', 'matricula', 'ativa', 'sit. matricula', 'turno', 'formacao',
  'atividades academicas obrigatorias', 'atividades academicas optativas',
  'elenco recomendado', 'dados atuais', 'ja aprovadas', 'ativ. acad.',
  'falta cumprir', 'ja cumpridos', 'totais a serem cumpridos', 'extensao',
];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isLinhaIgnorada(line) {
  const normalized = normalize(line);
  return IGNORE_TERMS.some((term) => normalized.includes(term));
}

function hasPendenteStatus(line) {
  const normalized = normalize(line);
  return PENDENTE_TERMS.some((term) => normalized.includes(term));
}

function hasNotaAprovacao(line) {
  const notas = line.match(/\b(\d+(?:\.\d)?)\b/g)?.map(Number) ?? [];
  return notas.some((n) => n >= 5 && n <= 10);
}

function extrairNome(line, codigo, idxCodigo) {
  // Toma tudo antes do código, remove prefixos numéricos e créditos.
  let prefixo = line.slice(0, idxCodigo).trim();

  // Remove crédito no final (ex: "4.0", "2.0").
  prefixo = prefixo.replace(/\d+\.\d\s*$/, '').trim();

  // Remove padrões "CH Per" no início (ex: "60 1", "90 8").
  prefixo = prefixo.replace(/^\d+\s+\d+\s*/, '').trim();

  return prefixo || codigo;
}

function extrairCreditos(line, idxCodigo) {
  const prefixo = line.slice(0, idxCodigo);
  const matches = prefixo.match(CREDITOS_REGEX);
  if (matches) {
    const last = matches[matches.length - 1];
    const value = parseFloat(last);
    if (value > 0 && value <= 10) return value;
  }
  return 4.0;
}

function extrairPeriodoRecomendado(line) {
  // Ex: "60 4Comput..." ou "90 8Trab..." (CH colada com período).
  const match = line.match(/^(\d{2,3})\s*(\d)(?=[A-Za-zÁ-Úá-ú\s])/);
  return match ? parseInt(match[2], 10) : null;
}

/**
 * Tenta extrair disciplinas pendentes de uma linha, considerando também
 * contexto de até 2 linhas adjacentes.
 * @param {string} line
 * @param {number} index
 * @param {string[]} allLines
 * @returns {Array<object>}
 */
export function parseBOALineRobust(line, index, allLines) {
  if (!line || line.length < 8 || isLinhaIgnorada(line)) return [];

  const resultados = [];
  const codigoMatches = [...line.matchAll(CODIGO_UFRJ_REGEX)];

  for (const match of codigoMatches) {
    const codigo = match[1];
    const idxCodigo = match.index;

    // Contexto pequeno: linha atual + vizinhas imediatas (status pode estar próximo).
    const contexto = [allLines[index - 1] || '', line, allLines[index + 1] || ''].join(' ');

    // Só considera pendente se houver termo de status na linha/contexto.
    if (!hasPendenteStatus(contexto)) continue;

    // Rejeita se a PRÓPRIA linha contiver nota de aprovação lançada (>= 5).
    if (hasNotaAprovacao(line)) continue;

    const nome = extrairNome(line, codigo, idxCodigo);
    const crR = extrairCreditos(line, idxCodigo);
    const periodoRecomendado = extrairPeriodoRecomendado(line);

    let status = 'pendente';
    const normalizedContext = normalize(contexto);
    if (normalizedContext.includes('inscricao vedada')) status = 'inscricao_vedada';
    else if (normalizedContext.includes('inscricao facultada')) status = 'inscricao_facultada';
    else if (normalizedContext.includes('cursando')) status = 'cursando';

    resultados.push({
      codigo,
      nome,
      crR,
      periodoRecomendado,
      status,
    });
  }

  return resultados;
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

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();

    if (lower.includes('atividades acadêmicas optativas')) {
      emOptativas = true;
      return;
    }

    if (lower.includes('falta cumprir') || lower.includes('já cumpridos')) {
      emOptativas = false;
      return;
    }

    const disciplinas = parseBOALineRobust(line, index, lines);
    disciplinas.forEach((d) => {
      console.log('[BOA] Disciplina pendente encontrada:', d);
      if (emOptativas || d.periodoRecomendado == null) {
        optativas.push(d);
      } else {
        obrigatorias.push(d);
      }
    });
  });

  return { obrigatorias, optativas };
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

/**
 * Processa um arquivo BOA e retorna as disciplinas pendentes.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @returns {Promise<{obrigatorias: Array<object>, optativas: Array<object>}>}
 */
export async function processarBOA(pdfData) {
  const lines = await extractBOAText(pdfData);
  return parseBOA(lines);
}
