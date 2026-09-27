/**
 * Parser opcional do Boletim de Orientação Acadêmica (BOA).
 *
 * Extrai disciplinas pendentes do currículo recomendado para sugerir no simulador.
 * Estratégia: texto completo do PDF reconstruído em linhas lógicas,
 * evitando dependência da quebra exata de linhas do pdf.js.
 */

const CODIGO_UFRJ_REGEX = /(?<![A-Za-z])([A-Z]{3}\d{3}|[A-Z]{3}[A-Z0-9]\d{2})\b/g;
const STATUS_REGEX = /(cursando|inscrição facultada|inscrição vedada|a cursar)/gi;
const PERIODO_REGEX = /(\d{2,3})\s+(\d)\s*[A-Za-zÁ-Úá-ú]/;

const IGNORED_KEYWORDS = [
  'pr1',
  'boletim de orientação acadêmica',
  'boletim',
  'ufrj',
  'dre',
  'cassio',
  'aluno',
  'data',
  'página',
  'emissão',
  'nome civil',
  'registro',
  'matrícula',
  'sit. matrícula',
];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isLinhaIgnorada(line) {
  const normalized = normalize(line);
  return IGNORED_KEYWORDS.some((kw) => normalized.includes(kw));
}

function detectarStatusPendente(line) {
  const normalized = normalize(line);
  if (normalized.includes('inscricao vedada')) return 'inscricao_vedada';
  if (normalized.includes('inscricao facultada')) return 'inscricao_facultada';
  if (normalized.includes('cursando')) return 'cursando';
  if (normalized.includes('a cursar')) return 'a_cursar';
  return null;
}

function hasNotaAprovacao(line, idxCodigo) {
  // Verifica apenas números APÓS o código, pois notas de aprovação ficam na coluna direita.
  const trecho = line.slice(idxCodigo + 3); // pula o código mínimo
  const notas = trecho.match(/\b(\d+(?:\.\d)?)\b/g)?.map(Number) ?? [];
  return notas.some((n) => n >= 5 && n <= 10);
}

function extractNome(line, idxCodigo) {
  const trecho = line.slice(Math.max(0, idxCodigo - 70), idxCodigo).trim();
  return trecho
    .replace(/\d+\.\d\s*$/, '')
    .replace(/^\d+\s+\d+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCreditos(line, idxCodigo) {
  const trecho = line.slice(Math.max(0, idxCodigo - 30), idxCodigo);
  const matches = trecho.match(/(\d+\.\d)/g);
  if (matches) {
    const value = parseFloat(matches[matches.length - 1]);
    if (value > 0 && value <= 10) return value;
  }
  return 4.0;
}

function extractPeriodoRecomendado(line, idxCodigo) {
  const trecho = line.slice(Math.max(0, idxCodigo - 60), idxCodigo);
  const match = trecho.match(PERIODO_REGEX);
  return match ? parseInt(match[2], 10) : null;
}

/**
 * Extrai todo o texto do PDF em uma única string.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @returns {Promise<string>}
 */
export async function extractBOAText(pdfData) {
  if (!window.pdfjsLib) {
    throw new Error('pdf.js não está disponível.');
  }

  const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item) => item.str).join(' ') + '\n';
  }

  return fullText;
}

/**
 * Reconstrói linhas lógicas do BOA a partir do texto concatenado.
 * Insere quebras antes de cada ocorrência do padrão de disciplina (CH Período Nome).
 * @param {string} text
 * @returns {string[]}
 */
function reconstruirLinhasBOA(text) {
  // Normaliza espaços múltiplos.
  let unified = text.replace(/\s+/g, ' ').trim();

  // Insere quebra de linha antes de cada início de disciplina: "60 4Nome" ou "90 8Nome".
  unified = unified.replace(/(\s|^)(\d{2,3})\s+(\d)([A-Za-zÁ-Úá-ú])/g, '$1\n$2 $3$4');

  // Insere quebra antes de "Inscrição Facultada" e "Inscrição Vedada" quando coladas
  // em outras partes da linha, mantendo o status junto à disciplina.
  unified = unified.replace(
    /([A-Za-z0-9.])(Inscrição Facultada|Inscrição Vedada)/gi,
    '$1\n$2'
  );

  // Quebra antes de seções subsequentes que não são disciplinas.
  unified = unified.replace(
    /(Falta Cumprir|Já Cumpridos|Totais a serem cumpridos|Extensão|--- PAGE \d+ ---)/gi,
    '\n$1'
  );

  return unified.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Parser principal do BOA.
 * @param {string} text
 * @returns {{obrigatorias: Array<object>, optativas: Array<object>}}
 */
export function parseBOA(text) {
  if (!text) return { obrigatorias: [], optativas: [] };

  const lines = reconstruirLinhasBOA(text);
  const obrigatorias = [];
  const optativas = [];
  const vistos = new Set();

  lines.forEach((line) => {
    if (isLinhaIgnorada(line)) return;

    const status = detectarStatusPendente(line);
    if (!status) return;

    const matches = [...line.matchAll(CODIGO_UFRJ_REGEX)];
    if (matches.length === 0) return;

    // Pega o primeiro código da linha (currículo recomendado).
    const match = matches[0];
    const codigo = match[1];
    const idxCodigo = match.index;

    // Evita duplicatas.
    const chave = `${codigo}-${status}-${line.length}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);

    // Só considera pendente se não houver nota de aprovação após o código na linha.
    if (hasNotaAprovacao(line, idxCodigo)) return;

    const nome = extractNome(line, idxCodigo);
    const crR = extractCreditos(line, idxCodigo);
    const periodoRecomendado = extractPeriodoRecomendado(line, idxCodigo);

    const disciplina = {
      codigo,
      nome: nome || codigo,
      crR,
      periodoRecomendado,
      status,
    };

    if (periodoRecomendado != null) {
      obrigatorias.push(disciplina);
    } else {
      optativas.push(disciplina);
    }
  });

  return { obrigatorias, optativas };
}

/**
 * Processa um arquivo BOA e retorna as disciplinas pendentes.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @returns {Promise<{obrigatorias: Array<object>, optativas: Array<object>}>}
 */
export async function processarBOA(pdfData) {
  const text = await extractBOAText(pdfData);
  return parseBOA(text);
}
