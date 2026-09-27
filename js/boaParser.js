/**
 * Parser opcional do Boletim de Orientação Acadêmica (BOA).
 *
 * Extrai disciplinas pendentes do currículo recomendado para sugerir no simulador.
 * Abordagem direta: procura no texto unificado por código UFRJ seguido de
 * status de pendência e extrai nome/créditos do trecho imediatamente anterior.
 */

const CODIGO_UFRJ_REGEX = /(?<![A-Za-z])([A-Z]{3}\d{3}|[A-Z]{3}[A-Z0-9]\d{2})\b/g;
const STATUS_LIST = ['cursando', 'inscrição facultada', 'inscrição vedada', 'a cursar'];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectarStatusPendente(line) {
  const normalized = normalize(line);
  if (normalized.includes('inscricao vedada')) return 'inscricao_vedada';
  if (normalized.includes('inscricao facultada')) return 'inscricao_facultada';
  if (normalized.includes('cursando')) return 'cursando';
  if (normalized.includes('a cursar')) return 'a_cursar';
  return null;
}

function hasAprovacaoExplicita(line) {
  // Verifica se há situação "AP" explícita associada a algum código na linha.
  // Isso evita capturar disciplinas já aprovadas na coluna de equivalências.
  return /\bAP\b/.test(line);
}

function extractNome(texto, idxCodigo) {
  // Trecho imediatamente antes do código (até 70 chars é suficiente para nome + créditos).
  let trecho = texto.slice(Math.max(0, idxCodigo - 70), idxCodigo);
  trecho = trecho.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim();

  // Padrão: CH Período Nome Créditos (ex: "60 4Comput ... 4.0").
  const match = trecho.match(/^(\d+)\s+(\d)\s*(.*?)\s*(\d+\.\d)$/);
  if (match) {
    return match[3].replace(/^\s*\d+\s+/, '').trim();
  }

  // Fallback: nome entre o primeiro número e o último decimal.
  const numeros = [...trecho.matchAll(/\d+\.\d|\d+/g)];
  if (numeros.length >= 2) {
    const inicio = numeros[0].index + numeros[0][0].length;
    const fim = numeros[numeros.length - 1].index;
    return trecho.slice(inicio, fim).replace(/^\s*\d+\s+/, '').trim();
  }

  return '';
}

function extractCreditos(texto, idxCodigo) {
  const trecho = texto.slice(Math.max(0, idxCodigo - 50), idxCodigo);
  const matches = trecho.match(/(\d+\.\d)/g);
  if (matches) {
    const value = parseFloat(matches[matches.length - 1]);
    if (value > 0 && value <= 10) return value;
  }
  return 4.0;
}

function extractPeriodoRecomendado(texto, idxCodigo) {
  const trecho = texto.slice(Math.max(0, idxCodigo - 120), idxCodigo);
  const match = trecho.match(/(\d{2,3})\s+(\d)\s*[A-Za-zÁ-Úá-ú]/);
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

  return reconstruirTextoBOA(fullText);
}

function reconstruirTextoBOA(text) {
  // Normaliza espaços, mas insere quebras lógicas antes de cada disciplina
  // do currículo recomendado (padrão CH Período Nome) e antes dos status.
  let unified = text.replace(/\s+/g, ' ').trim();

  // Quebra antes de cada início de disciplina: "60 4Nome" ou "90 8Nome".
  unified = unified.replace(/(\s|^)(\d{2,3})\s+(\d)([A-Za-zÁ-Úá-ú])/g, '$1\n$2 $3$4');

  // Quebra antes de seções que não são disciplinas.
  unified = unified.replace(
    /(Falta Cumprir|Já Cumpridos|Totais a serem cumpridos|Extensão|--- PAGE \d+ ---)/gi,
    '\n$1'
  );

  return unified;
}

/**
 * Parser principal do BOA.
 * @param {string} text
 * @returns {{obrigatorias: Array<object>, optativas: Array<object>}}
 */
export function parseBOA(text) {
  if (!text) return { obrigatorias: [], optativas: [] };

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const obrigatorias = [];
  const optativas = [];
  const vistos = new Set();

  lines.forEach((line) => {
    const status = detectarStatusPendente(line);
    if (!status) return;

    const matches = [...line.matchAll(CODIGO_UFRJ_REGEX)];
    if (matches.length === 0) return;

    const match = matches[0];
    const codigo = match[1];
    const idxCodigo = match.index;

    const chave = `${codigo}-${line.length}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);

    // Descarta linha que já contém disciplina aprovada explicitamente.
    if (hasAprovacaoExplicita(line)) return;

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
