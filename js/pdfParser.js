/**
 * Parser de PDFs do SIGA/UFRJ (boletim/histórico).
 *
 * Extrai metadados do aluno, disciplinas por período e totais oficiais.
 * Aplica as regras de negócio do CR:
 * - AP, RM, RF, RFM conferem grau.
 * - NCG, NCC, T e Cursando não conferem grau.
 */

import { situacaoConferGrau } from './calculator.js';

const HEADER_REGEX = /CH\s+SFGrau\s+CrO\s+PontosPer[íi]odo\s+C[óo]digo\s+Nome\s+da\s+Disciplina\/RCC\s+CrR/i;
const PERIODO_REGEX = /^\d{4}(?:\/\d)?$/;
const CODIGO_SITUACAO_REGEX = /([A-Z]+\d+)\s+(AP|RM|RF|RFM|NCG|NCC|T|CURSANDO)$/i;
const SITUACOES = ['AP', 'RM', 'RF', 'RFM', 'NCG', 'NCC', 'T', 'CURSANDO'];

/**
 * Extrai texto de um arquivo PDF usando pdfjs-dist.
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
    lines.push(...pageText.split('\n').map((l) => l.trim()).filter(Boolean));

    if (onProgress) {
      onProgress(i / pdf.numPages);
    }
  }

  return lines;
}

/**
 * Remove linhas de cabeçalho/legenda que se repetem em cada página.
 * @param {string[]} lines
 * @returns {string[]}
 */
export function limparLinhas(lines) {
  const ignorar = [
    /^SEM VALOR OFICIAL$/i,
    /^LEGENDA$/i,
    /^CrR\s+-/i,
    /^CrO\s+-/i,
    /^CH\s+-/i,
    /^SF\s+-/i,
    /^AP\s+-/i,
    /^RF\s+-/i,
    /^RM\s+-/i,
    /^RFM\s+-/i,
    /^NCC\s+-/i,
    /^NCG\s+-/i,
    /^CR\s+-/i,
    /^PR1\s+\/\s+DRE$/i,
    /^BOLETIM\s+NÃO\s+OFICIAL$/i,
    /^HISTÓRICO\s+NÃO\s+OFICIAL$/i,
    /^Unidade$/i,
    /^Curso$/i,
    /^Reconhecimento\/Renovação$/i,
    /^Pai$/i,
    /^Mãe$/i,
    /^GRADUAÇÃO$/i,
    /^Centro$/i,
    /^Naturalidade$/i,
    /^Nacionalidade\s+Certificado/i,
    /^Título\s+de\s+Eleitor$/i,
    /^Identidade$/i,
    /^CPF$/i,
    /^Ingresso$/i,
    /^Turno$/i,
    /^Data\s+de\s+Nascimento$/i,
    /^Página$/i,
    /^Conclusão$/i,
    /^CH\s+SFGrau/i,
    /^Creditos\s+transferidos/i,
  ];

  return lines.filter((line) => !ignorar.some((re) => re.test(line)));
}

/**
 * Extrai metadados do aluno a partir das linhas do PDF.
 * @param {string[]} lines
 * @returns {object}
 */
export function parseMetadata(lines) {
  const metadata = {
    nome: null,
    dre: null,
    curso: null,
    ingresso: null,
    emissao: null,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (!metadata.nome) {
      const nomeMatch = line.match(/^([A-ZÁ-ÚÀ-Ù\s]+?)\s*Nome\s*Civil$/i);
      if (nomeMatch) {
        metadata.nome = nomeMatch[1].trim();
        continue;
      }
    }

    if (!metadata.dre) {
      // O DRE aparece logo acima da label "Registro" no boletim/histórico.
      if (/^Registro$/i.test(nextLine)) {
        const m = line.match(/\b(\d{9,10})\b/);
        if (m) metadata.dre = m[1];
      }
    }

    if (!metadata.curso) {
      const cursoMatch = line.match(/(\d+\s+-\s+(?:Bacharelado\s+em\s+)?Ciência\s+da\s+Computação)/i);
      if (cursoMatch) {
        metadata.curso = cursoMatch[1];
        continue;
      }
    }

    if (!metadata.ingresso) {
      const ingressoMatch = line.match(/em:\s*(\d{4}\/\d)/i);
      if (ingressoMatch) {
        metadata.ingresso = ingressoMatch[1];
        continue;
      }
    }

    if (!metadata.emissao) {
      const emissaoMatch = line.match(/Brasileiro\s+Nato\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);
      if (emissaoMatch) {
        metadata.emissao = emissaoMatch[1];
        continue;
      }
    }
  }

  return metadata;
}

/**
 * Tenta interpretar uma linha como disciplina.
 * Retorna null se não for possível.
 * @param {string} line
 * @returns {object|null}
 */
export function parseDisciplinaLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('Prof.')) return null;

  // Remove ano opcional após a situação final (ex: AP2023)
  const semAno = trimmed.replace(
    /(AP|RM|RF|RFM|NCG|NCC|T|CURSANDO)\d{4}$/i,
    '$1'
  );

  // Separa situação final e código no final da linha.
  // Primeiro encontra o SF (case-insensitive); depois o código, que é
  // composto por letras maiúsculas seguidas de dígitos (case-sensitive).
  const sfRegex = new RegExp(`\\s+(${SITUACOES.join('|')})$`, 'i');
  const sfMatch = semAno.match(sfRegex);
  if (!sfMatch) return null;

  const situacao = sfMatch[1].toUpperCase();
  const antesSF = semAno.slice(0, semAno.length - sfMatch[0].length).trim();

  const codigoMatch = antesSF.match(/([A-Z]+\d+)$/);
  if (!codigoMatch) return null;

  const codigo = codigoMatch[1];
  const prefixo = antesSF.slice(0, antesSF.length - codigo.length).trim();

  // Tenta dividir o prefixo em <campos numéricos/texto> + <CH> + <nome>.
  // A CH é o último número decimal (precedido por espaço) antes do nome começar.
  let chMatch = prefixo.match(/^(.*)\s(\d+\.\d+)([A-Za-zÁ-Úá-ú].*)$/);
  let camposStr;
  let ch;
  let nome;

  if (chMatch) {
    camposStr = chMatch[1].trim();
    ch = parseFloat(chMatch[2]);
    nome = chMatch[3].trim();
  } else {
    // Fallback para quando a CH é textual (ex: ncc) ou ausente.
    // Os campos textuais podem estar colados uns com os outros ou com o
    // nome; inserimos espaços temporários para separá-los.
    const normalizado = prefixo
      .replace(/(\*{3,})(?=[A-Za-zÁ-Úá-ú])/gi, '$1 ')
      .replace(/(ncg|ncc)(?=[A-Za-zÁ-Úá-ú])/gi, '$1 ');
    const parts = normalizado.split(/\s+/).filter(Boolean);
    if (parts.length >= 6 && parts.slice(0, 5).every(isCampoTextualDisciplina)) {
      camposStr = parts.slice(0, 4).join(' ');
      ch = parts[4];
      nome = parts.slice(5).join(' ');
    } else {
      return null;
    }
  }

  // Extrai os quatro campos iniciais: grau, pontos, crO, crR.
  // A formatação do SIGA às vezes cola os números, então extraímos
  // tokens numéricos ou textuais conhecidos.
  const tokens = (camposStr.match(/(\d+\.\d)|([A-Za-z*]+)/g) || []).filter(Boolean);
  if (tokens.length < 4) return null;

  const [grauRaw, pontosRaw, crORaw, crRRaw] = tokens;

  return {
    grau: parseCampoDisciplina(grauRaw),
    pontos: parseCampoDisciplina(pontosRaw),
    crO: parseCampoDisciplina(crORaw),
    crR: parseCampoDisciplina(crRRaw),
    ch,
    nome,
    codigo,
    situacao,
    conferGrau: situacaoConferGrau(situacao),
  };
}

function isCampoTextualDisciplina(value) {
  const upper = String(value).toUpperCase();
  return upper === 'NCG' || upper === 'NCC' || upper === '*****';
}

function parseCampoDisciplina(value) {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  if (upper === '*****' || upper === 'NCC' || upper === 'NCG') return upper;
  const num = parseFloat(value);
  return isNaN(num) ? value : num;
}

/**
 * Verifica se uma linha representa o início de um novo período.
 * @param {string} line
 * @returns {boolean}
 */
export function isPeriodoLine(line) {
  return PERIODO_REGEX.test(line.trim());
}

/**
 * Parser principal: transforma as linhas do PDF em objeto estruturado.
 * @param {string[]} lines
 * @returns {object}
 */
export function parseHistorico(lines) {
  const cleanLines = limparLinhas(lines);
  const metadata = parseMetadata(cleanLines);

  const periodos = [];
  let currentPeriodo = null;
  let emTotais = false;

  function finalizarPeriodo() {
    if (currentPeriodo && currentPeriodo.disciplinas.length > 0) {
      // Se não houver período identificado, usa o último rótulo conhecido
      // ou um texto padrão para não deixar o campo vazio.
      if (!currentPeriodo.periodo) {
        const ultimoPeriodo = periodos[periodos.length - 1]?.periodo;
        currentPeriodo.periodo = ultimoPeriodo || 'Não identificado';
      }
      periodos.push(currentPeriodo);
    }
    currentPeriodo = null;
  }

  for (const line of cleanLines) {
    // Linhas de professores são ignoradas.
    if (line.startsWith('Prof.')) continue;

    // Detecta início de período.
    if (isPeriodoLine(line)) {
      const periodoValor = line.trim();

      if (currentPeriodo) {
        if (currentPeriodo.disciplinas.length > 0) {
          if (!currentPeriodo.periodo) {
            // Período veio depois das disciplinas (primeiro bloco do boletim).
            currentPeriodo.periodo = periodoValor;
            periodos.push(currentPeriodo);
            currentPeriodo = null;
          } else {
            // Período já estava definido: finaliza o atual e inicia novo.
            periodos.push(currentPeriodo);
            currentPeriodo = { periodo: periodoValor, disciplinas: [], totais: {} };
          }
        } else {
          // Período veio antes das disciplinas: define o período atual.
          currentPeriodo.periodo = periodoValor;
        }
      } else {
        currentPeriodo = { periodo: periodoValor, disciplinas: [], totais: {} };
      }

      emTotais = false;
      continue;
    }

    // Detecta início de bloco de totais.
    if (/^Totais:/i.test(line) || line.toLowerCase() === 'acumulado') {
      emTotais = true;
      continue;
    }

    // Tenta parsear disciplina.
    const disciplina = parseDisciplinaLine(line);
    if (disciplina) {
      if (!currentPeriodo) {
        // Disciplina sem período explícito anterior – cria período genérico.
        currentPeriodo = { periodo: null, disciplinas: [], totais: {} };
      }
      currentPeriodo.disciplinas.push(disciplina);
      emTotais = false;
      continue;
    }

    // Tenta extrair números de linhas de totais.
    if (emTotais && currentPeriodo) {
      const numeros = line.match(/\d+(?:\.\d+)?/g)?.map(Number);
      if (numeros && numeros.length > 0) {
        if (!currentPeriodo.totais.numerosBrutos) {
          currentPeriodo.totais.numerosBrutos = [];
        }
        currentPeriodo.totais.numerosBrutos.push(...numeros);
      }
    }
  }

  finalizarPeriodo();

  return { metadata, periodos, resumo: {} };
}

/**
 * Processa um arquivo PDF e retorna o histórico estruturado.
 * @param {ArrayBuffer | Uint8Array} pdfData
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<object>}
 */
export async function processarPDF(pdfData, onProgress) {
  const lines = await extractTextFromPDF(pdfData, onProgress);
  return parseHistorico(lines);
}
