/**
 * Classificação das disciplinas do BCC/UFRJ por eixos temáticos.
 */

import { disciplinaConferGrau } from './calculator.js';

export const EIXOS = {
  TEORIA: 'Teoria da Computação e Matemática',
  SISTEMAS: 'Sistemas Computacionais e Comunicação',
  ENGENHARIA: 'Engenharia de Software e Aplicações',
  DADOS: 'Ciência de Dados e Computação Científica',
  GERAL: 'Formação Humana, Social e Complementar',
  ELETIVAS: 'Eletivas',
  NAO_CONFERE_GRAU: 'Não Confere Grau',
};

const MAPA_EIXOS = {
  // 1. Teoria da Computação e Matemática
  ICP144: EIXOS.TEORIA,
  ICP115: EIXOS.TEORIA,
  ICP123: EIXOS.TEORIA,
  ICP368: EIXOS.TEORIA,
  ICP370: EIXOS.TEORIA,
  ICP116: EIXOS.TEORIA, // Estrutura de Dados
  ICP471: EIXOS.TEORIA,
  ICP478: EIXOS.TEORIA,
  MAB624: EIXOS.TEORIA,
  ICP134: EIXOS.TEORIA,
  MAE111: EIXOS.TEORIA,
  MAE992: EIXOS.TEORIA,
  MAE993: EIXOS.TEORIA,
  MAE994: EIXOS.TEORIA,
  MAD243: EIXOS.TEORIA,

  // 2. Sistemas e Comunicação
  ICP133: EIXOS.SISTEMAS,
  MAB111: EIXOS.SISTEMAS,
  MAB245: EIXOS.SISTEMAS,
  ICP246: EIXOS.SISTEMAS,
  ICP361: EIXOS.SISTEMAS,
  ICP362: EIXOS.SISTEMAS,
  ICP473: EIXOS.SISTEMAS,
  ICP240: EIXOS.SISTEMAS, // Computação II (CC)
  MAB120: EIXOS.SISTEMAS, // Computação I (CC)
  ICP353: EIXOS.SISTEMAS, // Computadores e Programação

  // 3. Engenharia de Software e Aplicações
  ICP131: EIXOS.ENGENHARIA,
  ICP141: EIXOS.ENGENHARIA,
  ICP132: EIXOS.ENGENHARIA,
  MAB112: EIXOS.ENGENHARIA,
  ICP237: EIXOS.ENGENHARIA,
  ICP239: EIXOS.ENGENHARIA,
  ICP489: EIXOS.ENGENHARIA,
  ICP491: EIXOS.ENGENHARIA,
  ICP142: EIXOS.ENGENHARIA,
  ICP143: EIXOS.ENGENHARIA,
  MAB113: EIXOS.ENGENHARIA,
  ICP472: EIXOS.ENGENHARIA,

  // 4. Ciência de Dados e Computação Científica
  ICP248: EIXOS.DADOS,
  ICP238: EIXOS.DADOS,
  ICP350: EIXOS.DADOS,
  ICP351: EIXOS.DADOS,
  ICP363: EIXOS.DADOS,
  ICP365: EIXOS.DADOS,

  // 5. Formação Humana, Social e Complementar
  ICP135: EIXOS.GERAL,
  ICP007: EIXOS.GERAL,
  ICP145: EIXOS.GERAL,
  ICP008: EIXOS.GERAL,
  ICP354: EIXOS.GERAL,
  ICP136: EIXOS.GERAL,
  ICP005: EIXOS.GERAL,
  ICPK01: EIXOS.GERAL,
  ICPX06: EIXOS.GERAL, // Atividades Complementares
  ICPZ55: EIXOS.GERAL, // Extensão
  CMT001: EIXOS.GERAL,

  // 6. Equivalências históricas (MAB/legados)
  MAB352: EIXOS.TEORIA,
  MAB115: EIXOS.TEORIA,
  MAB123: EIXOS.TEORIA,
  MAB368: EIXOS.TEORIA,
  MAB116: EIXOS.TEORIA, // Estrutura de Dados -> ICP116
  MAB240: EIXOS.ENGENHARIA,
  MAB353: EIXOS.SISTEMAS, // Computadores e Programação -> ICP353
  MAB489: EIXOS.ENGENHARIA,
  MAB230: EIXOS.DADOS,
  MAB515: EIXOS.DADOS,
  MAB355: EIXOS.SISTEMAS,
  MAB366: EIXOS.SISTEMAS,
  MAB117: EIXOS.SISTEMAS,
  ICP510: EIXOS.SISTEMAS,
  ICP232: EIXOS.DADOS,
  ICP236: EIXOS.TEORIA,
  ICP004: EIXOS.DADOS,
};

// Engloba os prefixos de exatas (MAE, MAD, MAF, MAC) no eixo de Teoria e Matemática
const PREFIXOS_EIXOS = [
  [/^MA[EDFC]/, EIXOS.TEORIA],
];

/**
 * Retorna o eixo temático de uma disciplina pelo código.
 * @param {string} codigo
 * @returns {string}
 */
export function eixoDaDisciplina(codigo) {
  const cod = String(codigo || '').trim().toUpperCase();
  if (MAPA_EIXOS[cod]) return MAPA_EIXOS[cod];
  for (const [regex, eixo] of PREFIXOS_EIXOS) {
    if (regex.test(cod)) return eixo;
  }
  // Fallback: tudo que confere grau e não está no mapa obrigatório é Eletiva
  return EIXOS.ELETIVAS;
}

/**
 * Agrupa as disciplinas concluídas por eixo e calcula métricas.
 * @param {object} historyData
 * @returns {Array<{eixo: string, cr: number, crRComGrau: number, creditosTotais: number, total: number, disciplinas: Array}>}
 */
export function calcularMetricasPorEixo(historyData) {
  const grupos = new Map();

  (historyData?.periodos || []).forEach((periodo) => {
    (periodo.disciplinas || []).forEach((d) => {
      // 1. Verifica se a disciplina possui grau numérico e confere grau pro CR
      const confere = disciplinaConferGrau(d);

      // 2. Direciona para o eixo apropriado ou para "Não Confere Grau"
      const eixo = confere ? eixoDaDisciplina(d.codigo) : EIXOS.NAO_CONFERE_GRAU;

      if (!grupos.has(eixo)) {
        grupos.set(eixo, { eixo, pontos: 0, crRComGrau: 0, creditosTotais: 0, total: 0, disciplinas: [] });
      }
      const g = grupos.get(eixo);
      g.total += 1;
      g.disciplinas.push({ ...d, periodo: periodo.periodo });

      const crR = Number(d.crR);
      if (!isNaN(crR)) g.creditosTotais += crR;

      if (confere) {
        g.crRComGrau += crR || 0;
        g.pontos += Number(d.pontos) || (Number(d.grau) || 0) * (crR || 0);
      }
    });
  });

  return [...grupos.values()]
    .map((g) => ({ ...g, cr: g.crRComGrau ? g.pontos / g.crRComGrau : 0 }))
    .sort((a, b) => {
      // Empurra o bloco "Não Confere Grau" sempre para o final da renderização
      if (a.eixo === EIXOS.NAO_CONFERE_GRAU) return 1;
      if (b.eixo === EIXOS.NAO_CONFERE_GRAU) return -1;
      return b.creditosTotais - a.creditosTotais;
    });
}
