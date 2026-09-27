/**
 * Motor de cálculo de CR acumulado, do período e metas reversas.
 *
 * Regras de negócio implementadas:
 * - CR = Σ(Grau × CrR) / Σ(CrR), considerando apenas disciplinas que conferem grau.
 * - Conferem grau: AP, RM, RF, RFM cujo grau seja um número válido.
 * - Não conferem grau: situações NCG, NCC, T, Cursando, ou quando o
 *   campo grau for textual (T, NCG, NCC, *****), indicando transferência
 *   ou disciplinas que não computam nota para o CR.
 * - Períodos com trancamentos são ignorados.
 */

const SITUACOES_COM_GRAU = ['AP', 'RM', 'RF', 'RFM'];
const SITUACOES_SEM_GRAU = ['NCG', 'NCC', 'T', 'CURSANDO'];
const GRAUS_TEXTUAIS_SEM_GRAU = ['T', 'NCG', 'NCC', '*****'];

/**
 * Determina se uma situação final (SF) confere grau.
 * @param {string} situacao
 * @returns {boolean}
 */
export function situacaoConferGrau(situacao) {
  if (!situacao) return false;
  return SITUACOES_COM_GRAU.includes(String(situacao).toUpperCase());
}

/**
 * Verifica se o grau é um número válido.
 * @param {number | string | null | undefined} grau
 * @returns {boolean}
 */
function isGrauNumericoValido(grau) {
  return typeof grau === 'number' && !isNaN(grau);
}

/**
 * Verifica se o grau é textual e não confere grau (T, NCG, NCC, *****).
 * @param {number | string | null | undefined} grau
 * @returns {boolean}
 */
function isGrauTextualSemGrau(grau) {
  if (grau === null || grau === undefined) return true;
  return GRAUS_TEXTUAIS_SEM_GRAU.includes(String(grau).toUpperCase());
}

/**
 * Determina se uma disciplina confere grau para o cálculo do CR.
 * Considera tanto a situação final quanto o tipo do grau.
 * @param {object} disciplina
 * @returns {boolean}
 */
export function disciplinaConferGrau(disciplina) {
  if (!disciplina) return false;
  const situacao = String(disciplina.situacao || '').toUpperCase();

  // Situações explícitas sem grau
  if (SITUACOES_SEM_GRAU.includes(situacao)) return false;

  // Grau textual indica transferência ou disciplina sem nota
  if (isGrauTextualSemGrau(disciplina.grau)) return false;

  // Apenas situações com grau e grau numérico válido entram
  return SITUACOES_COM_GRAU.includes(situacao) && isGrauNumericoValido(disciplina.grau);
}

/**
 * Retorna o peso de créditos de uma disciplina.
 * Apenas disciplinas que conferem grau entram no numerador/denominador.
 * @param {object} disciplina
 * @returns {{crR: number, pontos: number}}
 */
export function extrairPesoDisciplina(disciplina) {
  const confere = disciplinaConferGrau(disciplina);
  if (!confere) return { crR: 0, pontos: 0 };
  return {
    crR: Number(disciplina.crR) || 0,
    pontos: Number(disciplina.pontos) || Number(disciplina.grau) * (Number(disciplina.crR) || 0) || 0,
  };
}

/**
 * Calcula CR simples a partir de pontos e créditos.
 * @param {number} pontos
 * @param {number} crR
 * @returns {number}
 */
export function calcularCR(pontos, crR) {
  if (!crR) return 0;
  return pontos / crR;
}

/**
 * Calcula CR a partir de uma lista de disciplinas.
 * @param {Array<object>} disciplinas
 * @returns {{crRComGrau: number, pontosTotais: number, crCalculado: number}}
 */
export function calcularCRDisciplinas(disciplinas) {
  const { crRComGrau, pontosTotais } = (disciplinas || []).reduce(
    (acc, d) => {
      const peso = extrairPesoDisciplina(d);
      return {
        crRComGrau: acc.crRComGrau + peso.crR,
        pontosTotais: acc.pontosTotais + peso.pontos,
      };
    },
    { crRComGrau: 0, pontosTotais: 0 }
  );
  return {
    crRComGrau,
    pontosTotais,
    crCalculado: calcularCR(pontosTotais, crRComGrau),
  };
}

/**
 * Calcula CR acumulado a partir do histórico parseado.
 * @param {object} historyData
 * @param {Array<object>} [disciplinasExtras]
 * @returns {{crRComGrau: number, pontosTotais: number, crCalculado: number}}
 */
export function calcularCRAcumulado(historyData, disciplinasExtras = []) {
  const disciplinas = [];
  if (historyData?.periodos) {
    historyData.periodos.forEach((periodo) => {
      if (Array.isArray(periodo.disciplinas)) {
        disciplinas.push(...periodo.disciplinas);
      }
    });
  }
  if (Array.isArray(disciplinasExtras)) {
    disciplinas.push(...disciplinasExtras);
  }
  return calcularCRDisciplinas(disciplinas);
}

/**
 * Calcula a média necessária nas disciplinas restantes para atingir um CR alvo.
 *
 * Fórmula:
 * mediaNecessaria = (X * (crRBase + crRPreenchidas + crRRestantes) - pontosBase - pontosPreenchidos) / crRRestantes
 *
 * @param {number} crAlvo
 * @param {object} historyData
 * @param {Array<object>} [disciplinasPreenchidas] Disciplinas do período atual já com nota.
 * @param {Array<object>} [disciplinasRestantes] Disciplinas do período atual sem nota.
 * @returns {number|null} Retorna null se não houver créditos restantes.
 */
export function calcularMetaReversa(
  crAlvo,
  historyData,
  disciplinasPreenchidas = [],
  disciplinasRestantes = []
) {
  const base = calcularCRAcumulado(historyData, []);
  const preenchidas = calcularCRDisciplinas(disciplinasPreenchidas);
  const crRRestantes = (disciplinasRestantes || []).reduce(
    (sum, d) => sum + (Number(d.crR) || 0),
    0
  );

  if (crRRestantes <= 0) return null;

  const crRTotal = base.crRComGrau + preenchidas.crRComGrau + crRRestantes;
  const pontosNecessarios =
    crAlvo * crRTotal - base.pontosTotais - preenchidas.pontosTotais;

  return pontosNecessarios / crRRestantes;
}

/**
 * Calcula o impacto absoluto e percentual de um novo CR sobre o CR base.
 * @param {number} crBase
 * @param {number} crNovo
 * @returns {{absoluto: number, percentual: number}}
 */
export function calcularImpactoCR(crBase, crNovo) {
  const absoluto = crNovo - crBase;
  const percentual = crBase ? (absoluto / crBase) * 100 : 0;
  return { absoluto, percentual };
}

/* ============================================================
   Testes manuais (podem ser executados no console do navegador
   importando runCalculatorTests de './calculator.js').
   ============================================================ */

/**
 * Assert numérico com tolerância de ponto flutuante.
 * @param {number} actual
 * @param {number} expected
 * @param {string} message
 */
function assertEqual(actual, expected, message) {
  const ok = Math.abs(actual - expected) < 1e-6;
  if (!ok) {
    throw new Error(`${message}: esperado ${expected}, obtido ${actual}`);
  }
}

/**
 * Assert booleano simples.
 * @param {boolean} condition
 * @param {string} message
 */
function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Executa os testes de borda do motor de cálculo e loga o resultado.
 */
export function runCalculatorTests() {
  const results = [];

  // 1. Situações que conferem grau
  assertTrue(situacaoConferGrau('AP'), 'AP deve conferir grau');
  assertTrue(situacaoConferGrau('RM'), 'RM deve conferir grau');
  assertTrue(situacaoConferGrau('RF'), 'RF deve conferir grau');
  assertTrue(situacaoConferGrau('RFM'), 'RFM deve conferir grau');
  assertTrue(!situacaoConferGrau('NCG'), 'NCG não deve conferir grau');
  assertTrue(!situacaoConferGrau('NCC'), 'NCC não deve conferir grau');
  assertTrue(!situacaoConferGrau('T'), 'T não deve conferir grau');
  assertTrue(!situacaoConferGrau('Cursando'), 'Cursando não deve conferir grau');
  results.push('Situações de grau: OK');

  // 1b. Disciplina com grau textual T/NCG/NCC não entra no CR
  assertTrue(
    !disciplinaConferGrau({ situacao: 'AP', grau: 'T', crR: 4 }),
    'Transferência (grau T) não confere grau'
  );
  assertTrue(
    !disciplinaConferGrau({ situacao: 'AP', grau: 'NCG', crR: 2 }),
    'NCG textual não confere grau'
  );
  assertTrue(
    disciplinaConferGrau({ situacao: 'AP', grau: 10.0, crR: 4 }),
    'AP com grau numérico confere grau'
  );
  assertTrue(
    disciplinaConferGrau({ situacao: 'RM', grau: 0, crR: 4 }),
    'RM com grau numérico confere grau'
  );
  results.push('Grau textual T/NCG/NCC excluído: OK');

  // 2. CR simples
  assertEqual(calcularCR(42, 6), 7, 'CR simples 42/6');
  assertEqual(calcularCR(0, 5), 0, 'CR com pontos 0');
  assertEqual(calcularCR(10, 0), 0, 'CR com créditos 0 deve ser 0');
  results.push('CR simples: OK');

  // 3. Lista de disciplinas com reprovação puxando CR para baixo
  const disciplinas = [
    { situacao: 'AP', grau: 8.4, crR: 5, pontos: 42 },
    { situacao: 'RM', grau: 0, crR: 4, pontos: 0 },
  ];
  const res = calcularCRDisciplinas(disciplinas);
  assertEqual(res.crRComGrau, 9, 'Total de CrR com grau');
  assertEqual(res.pontosTotais, 42, 'Total de pontos');
  assertEqual(res.crCalculado, 42 / 9, 'CR com reprovação');
  results.push('Reprovação no CR: OK');

  // 4. NCG/NCC/T não entram no CR
  const mista = [
    { situacao: 'AP', grau: 8, crR: 4, pontos: 32 },
    { situacao: 'NCG', crR: 2, pontos: 0 },
    { situacao: 'T', crR: 4, pontos: 0 },
    { situacao: 'Cursando', crR: 4, pontos: 0 },
  ];
  const resMista = calcularCRDisciplinas(mista);
  assertEqual(resMista.crRComGrau, 4, 'Apenas AP entra no CrR');
  assertEqual(resMista.pontosTotais, 32, 'Apenas AP entra nos pontos');
  assertEqual(resMista.crCalculado, 8, 'CR ignora NCG/T/Cursando');
  results.push('NCG/T/Cursando ignorados: OK');

  // 5. CR acumulado a partir de historyData
  const historyData = {
    periodos: [
      {
        periodo: '2020/2',
        disciplinas: [
          { situacao: 'AP', grau: 8.4, crR: 5, pontos: 42 },
          { situacao: 'RM', grau: 0, crR: 4, pontos: 0 },
          { situacao: 'NCG', crR: 2, pontos: 0 },
        ],
      },
    ],
  };
  const resAcum = calcularCRAcumulado(historyData);
  assertEqual(resAcum.crRComGrau, 9, 'CrR acumulado efetivo');
  assertEqual(resAcum.crCalculado, 42 / 9, 'CR acumulado');
  results.push('CR acumulado via historyData: OK');

  // 6. Novo CR acumulado com disciplinas extras
  const extras = [{ situacao: 'AP', grau: 9, crR: 6, pontos: 54 }];
  const resNovo = calcularCRAcumulado(historyData, extras);
  assertEqual(resNovo.crRComGrau, 15, 'CrR base + extras');
  assertEqual(resNovo.pontosTotais, 96, 'Pontos base + extras');
  assertEqual(resNovo.crCalculado, 96 / 15, 'Novo CR acumulado');
  results.push('Novo CR acumulado: OK');

  // 7. Meta reversa
  // Base: CrR=9, Pontos=42 → CR=4.6667
  // Queremos CR=6.0 com 1 disciplina de 4 créditos restantes e 1 já preenchida (grau 8, crR=4 → pontos=32)
  const preenchidas = [{ situacao: 'AP', grau: 8, crR: 4, pontos: 32 }];
  const restantes = [{ situacao: 'Cursando', crR: 4 }];
  const meta = calcularMetaReversa(6.0, historyData, preenchidas, restantes);
  // (6 * (9+4+4) - 42 - 32) / 4 = (6*17 - 74) / 4 = (102-74)/4 = 7.0
  assertEqual(meta, 7.0, 'Meta reversa');
  results.push('Meta reversa: OK');

  // 8. Meta reversa inviável (créditos restantes = 0)
  const metaImpossivel = calcularMetaReversa(6.0, historyData, preenchidas, []);
  assertTrue(metaImpossivel === null, 'Meta reversa sem créditos restantes deve retornar null');
  results.push('Meta reversa inviável: OK');

  // 9. Impacto no CR
  const impacto = calcularImpactoCR(5, 6);
  assertEqual(impacto.absoluto, 1, 'Impacto absoluto');
  assertEqual(impacto.percentual, 20, 'Impacto percentual');
  results.push('Impacto no CR: OK');

  console.log('[calculator.js] Testes passaram:');
  results.forEach((r) => console.log('  ✓', r));
  return true;
}
