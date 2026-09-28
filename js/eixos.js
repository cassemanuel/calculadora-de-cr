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

/* ============================================================
   Elegibilidade para Estágio Não Obrigatório (PPC 2022, Art. 4º
   do Anexo C — Programa de Estágio)
   ============================================================ */

const CR_MINIMO_ESTAGIO = 6.0;
const MAX_PERIODOS_INTEGRALIZACAO = 14;

// Disciplinas obrigatórias do ciclo básico: 1º ao 4º período do PPC 2022.
// Cada item aceita o código vigente ou qualquer equivalente histórico (MAB/ICP
// antigas), conforme a tabela de correspondências curriculares — inclusive as
// disciplinas da grade de transição (ICP007/ICP008).
const CICLO_BASICO = [
  // 1º Período
  { codigo: 'ICP131', nome: 'Programação de Computadores I', aceitos: ['ICP131', 'MAB120'] },
  { codigo: 'ICP132', nome: 'Processos de Software', aceitos: ['ICP132', 'MAB112'] },
  { codigo: 'ICP133', nome: 'Fund. de Sist. da Computação', aceitos: ['ICP133', 'MAB111'] },
  { codigo: 'ICP134', nome: 'Números Inteiros e Criptografia', aceitos: ['ICP134', 'MAB624'] },
  { codigo: 'ICP135', nome: 'Projeto de Carreira', aceitos: ['ICP135', 'ICP007'] },
  { codigo: 'ICP136', nome: 'Introdução ao Pensamento Dedutivo', aceitos: ['ICP136'] },
  // 2º Período
  { codigo: 'ICP141', nome: 'Programação de Computadores II', aceitos: ['ICP141', 'MAB120'] },
  { codigo: 'ICP142', nome: 'Organização de Dados I', aceitos: ['ICP142', 'MAB113'] },
  { codigo: 'ICP143', nome: 'Projeto Prático', aceitos: ['ICP143', 'MAB245'] },
  { codigo: 'ICP144', nome: 'Matemática Discreta', aceitos: ['ICP144', 'MAB352'] },
  { codigo: 'ICP145', nome: 'Habilidades Sociais para o Trabalho', aceitos: ['ICP145', 'ICP008'] },
  { codigo: 'MAE111', nome: 'Cálculo Infinitesimal I', aceitos: ['MAE111'] },
  // 3º Período
  { codigo: 'ICP115', nome: 'Álgebra Linear Algorítmica', aceitos: ['ICP115', 'MAB115'] },
  { codigo: 'ICP116', nome: 'Estrutura dos Dados', aceitos: ['ICP116', 'MAB116'] },
  { codigo: 'ICP211', nome: 'Introd. a Modelagem de Sistemas', aceitos: ['ICP211', 'ICP237'] },
  { codigo: 'ICP212', nome: 'Introdução à Computação Numérica', aceitos: ['ICP212', 'ICP238', 'MAB230'] },
  { codigo: 'ICP213', nome: 'Programação Orientada a Objetos', aceitos: ['ICP213', 'ICP239', 'ICP240', 'MAB240'] },
  { codigo: 'MAE992', nome: 'Cálculo Integral e Diferencial II', aceitos: ['MAE992'] },
  // 4º Período
  { codigo: 'ICP251', nome: 'Arquitetura de Computadores e SO', aceitos: ['ICP251', 'ICP246', 'MAB355', 'MAB366'] },
  { codigo: 'ICP252', nome: 'Computação Científica e Análise de Dados', aceitos: ['ICP252', 'ICP248', 'MAB230'] },
  { codigo: 'ICP253', nome: 'Tecnologia e Sociedade', aceitos: ['ICP253', 'ICP354', 'MAB354'] },
  { codigo: 'ICP489', nome: 'Banco de Dados I', aceitos: ['ICP489', 'MAB489'] },
  { codigo: 'MAD243', nome: 'Estatística e Probabilidade', aceitos: ['MAD243'] }
];

/**
 * Verifica se a disciplina do histórico conta como concluída para fins de
 * integralização (aprovada com grau ou cursada via equivalência/transferência).
 * @param {object} disciplina
 * @returns {boolean}
 */
function disciplinaConcluida(disciplina) {
  const situacao = String(disciplina?.situacao || '').toUpperCase();
  const grau = String(disciplina?.grau ?? '').toUpperCase();
  return situacao === 'AP' || situacao === 'T' || grau === 'T';
}

/**
 * Avalia a elegibilidade do aluno para estágio não obrigatório conforme o
 * PPC 2022: ciclo básico concluído, CR acumulado mínimo de 6,000 e tempo de
 * curso dentro do máximo de integralização (14 períodos).
 * @param {object} historyData
 * @returns {{apto: boolean, criterios: Array<{rotulo: string, ok: boolean, detalhe: string}>}}
 */
export function verificarElegibilidadeEstagio(historyData) {
  const periodos = historyData?.periodos || [];
  const disciplinas = periodos.flatMap((p) => p.disciplinas || []);
  const codigosConcluidos = new Set(
    disciplinas
      .filter(disciplinaConcluida)
      .map((d) => String(d.codigo || '').trim().toUpperCase())
  );

  const faltantes = CICLO_BASICO.filter(
    (req) => !req.aceitos.some((cod) => codigosConcluidos.has(cod))
  );

  const crAcumulado = historyData?.resumo?.crCalculado ?? 0;
  const periodosCursados = new Set(
    periodos.map((p) => String(p.periodo || '').trim()).filter(Boolean)
  ).size;

  const criterios = [
    {
      rotulo: 'Ciclo básico concluído (1º–4º período)',
      ok: faltantes.length === 0,
      detalhe: faltantes.length
        ? `Faltam disciplinas do ciclo básico: ${faltantes.map((f) => f.codigo).join(', ')}`
        : 'Todas as obrigatórias do ciclo básico foram concluídas.',
    },
    {
      rotulo: `CR acumulado mínimo de ${CR_MINIMO_ESTAGIO.toFixed(3)}`,
      ok: crAcumulado >= CR_MINIMO_ESTAGIO,
      detalhe: `CR atual ${crAcumulado.toFixed(3).replace('.', ',')} (mínimo ${CR_MINIMO_ESTAGIO.toFixed(3).replace('.', ',')})`,
    },
    {
      rotulo: `Tempo de curso dentro de ${MAX_PERIODOS_INTEGRALIZACAO} períodos`,
      ok: periodosCursados <= MAX_PERIODOS_INTEGRALIZACAO,
      detalhe: `${periodosCursados} períodos cursados (máx. ${MAX_PERIODOS_INTEGRALIZACAO})`,
    },
  ];

  return { apto: criterios.every((c) => c.ok), criterios };
}
