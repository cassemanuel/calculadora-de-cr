/**
 * Classificação das disciplinas do BCC/UFRJ por eixos temáticos.
 *
 * A categorização usa um mapa explícito de códigos e, como fallback,
 * regras por prefixo do código. Disciplinas não catalogadas caem em
 * "Outros".
 */

import { disciplinaConferGrau } from './calculator.js';

export const EIXOS = {
  TEORIA: 'Teoria e Matemática',
  SISTEMAS: 'Sistemas e Hardware',
  ENGENHARIA: 'Engenharia e Aplicações',
  GERAL: 'Formação Geral e Sociedade',
  OUTROS: 'Outros',
};

const MAPA_EIXOS = {
  // Teoria e Matemática
  ICP144: EIXOS.TEORIA, // Matemática Discreta
  ICP115: EIXOS.TEORIA, // Álgebra Linear Algorítmica
  ICP116: EIXOS.TEORIA, // Álgebra Linear Algorítmica II / Estruturas de Dados
  MAE111: EIXOS.TEORIA, // Cálculo Infinitesimal I
  MAE992: EIXOS.TEORIA, // Cálculo Integ e Diferencial II
  MAE993: EIXOS.TEORIA, // Cálculo III
  MAE994: EIXOS.TEORIA, // Cálculo IV
  MAB624: EIXOS.TEORIA, // Números Inteiros e Criptografia
  MAD243: EIXOS.TEORIA, // Estatística e Probabilidade
  ICP123: EIXOS.TEORIA, // Linguagens Formais
  ICP368: EIXOS.TEORIA, // Algoritmos e Grafos
  ICP370: EIXOS.TEORIA, // Lógica e Computabilidade
  ICP471: EIXOS.TEORIA, // Compiladores
  ICP478: EIXOS.TEORIA, // Métodos Numéricos I
  ICP518: EIXOS.TEORIA, // Teoria de Grafos
  ICP532: EIXOS.TEORIA, // Mineração de Dados
  ICP633: EIXOS.TEORIA, // Algoritmos de Aproximação
  ICP638: EIXOS.TEORIA, // Computação Algébrica
  ICP639: EIXOS.TEORIA, // Computação Quântica
  ICP035: EIXOS.TEORIA,
  ICP036: EIXOS.TEORIA,

  // Sistemas e Hardware
  MAB245: EIXOS.SISTEMAS, // Circuitos Lógicos
  MAB111: EIXOS.SISTEMAS, // Fund da Computação Digital
  ICP133: EIXOS.SISTEMAS, // Fund de Sistemas de Computação
  ICP246: EIXOS.SISTEMAS, // Arquitetura de Computadores e SO
  ICP361: EIXOS.SISTEMAS, // Programação Concorrente
  ICP362: EIXOS.SISTEMAS, // Redes de Computadores I
  ICP026: EIXOS.SISTEMAS, // Redes de Computadores II
  ICP473: EIXOS.SISTEMAS, // Segurança da Informação
  ICP027: EIXOS.SISTEMAS, // Criptografia
  ICP025: EIXOS.SISTEMAS, // Computação em Nuvem
  ICP028: EIXOS.SISTEMAS, // Tóp Esp em Arquitetura

  // Engenharia e Aplicações
  MAB120: EIXOS.ENGENHARIA, // Computação I
  ICP141: EIXOS.ENGENHARIA, // Programação de Computadores II
  ICP131: EIXOS.ENGENHARIA, // Programação de Computadores I
  ICP132: EIXOS.ENGENHARIA, // Processos de Software
  ICP134: EIXOS.ENGENHARIA,
  ICP135: EIXOS.ENGENHARIA,
  ICP142: EIXOS.ENGENHARIA,
  ICP143: EIXOS.ENGENHARIA, // Projeto Prático
  ICP145: EIXOS.ENGENHARIA,
  MAB113: EIXOS.ENGENHARIA, // Organização da Informação
  ICP237: EIXOS.ENGENHARIA, // Introd à Modelagem de Sistemas
  ICP238: EIXOS.ENGENHARIA, // Introd à Computação Numérica
  ICP239: EIXOS.ENGENHARIA, // Programação Orientada a Objetos
  ICP240: EIXOS.ENGENHARIA, // Computação II
  ICP248: EIXOS.ENGENHARIA, // Computação Científica e Análise de Dados
  ICP249: EIXOS.ENGENHARIA, // Tecnologia e Sociedade -> movido? mantido Engenharia
  ICP350: EIXOS.ENGENHARIA, // Modelagem e Avaliação de Desempenho
  ICP351: EIXOS.ENGENHARIA, // Modelagem Matemática e Computacional
  ICP353: EIXOS.ENGENHARIA, // Computadores e Programação
  ICP041: EIXOS.ENGENHARIA,
  ICP042: EIXOS.ENGENHARIA,
  ICP363: EIXOS.ENGENHARIA, // Aprendizado de Máquina
  ICP365: EIXOS.ENGENHARIA, // Otimização
  ICP472: EIXOS.ENGENHARIA, // Metodologia da Pesquisa
  ICPK01: EIXOS.ENGENHARIA, // TCC
  ICP006: EIXOS.ENGENHARIA, // Internet das Coisas
  ICP489: EIXOS.ENGENHARIA, // Banco de Dados I
  ICP491: EIXOS.ENGENHARIA, // Banco de Dados II
  ICP356: EIXOS.ENGENHARIA, // Organização de Dados II
  ICP357: EIXOS.ENGENHARIA, // Data Warehousing
  ICP359: EIXOS.ENGENHARIA, // Suporte à Decisão
  ICP367: EIXOS.ENGENHARIA, // Sistemas Distribuídos
  ICP508: EIXOS.ENGENHARIA, // Inteligência Artificial
  ICP616: EIXOS.ENGENHARIA, // IHC
  ICP061: EIXOS.ENGENHARIA, // Desenvolvimento Web I
  ICP062: EIXOS.ENGENHARIA, // Desenvolvimento Web II
  ICP051: EIXOS.ENGENHARIA,
  ICP052: EIXOS.ENGENHARIA,
  ICP020: EIXOS.ENGENHARIA, // Engenharia de Software
  ICP021: EIXOS.ENGENHARIA,
  ICP022: EIXOS.ENGENHARIA,
  ICP640: EIXOS.ENGENHARIA, // Projeto e Teste de Software
  ICP031: EIXOS.ENGENHARIA,
  ICP032: EIXOS.ENGENHARIA,
  ICP071: EIXOS.ENGENHARIA,
  ICP072: EIXOS.ENGENHARIA,
  ICP095: EIXOS.ENGENHARIA, // Tóp Esp em Ciência da Computação V

  // Formação Geral e Sociedade
  ICP007: EIXOS.GERAL, // Projeto de Carreira
  ICP008: EIXOS.GERAL, // Habilidades Sociais para o Trabalho
  ICP136: EIXOS.GERAL, // Introd Pensamento Dedutivo
  ICP354: EIXOS.GERAL, // Computadores e Sociedade
  ICPX06: EIXOS.GERAL, // Atividades Complementares
  ICPZ55: EIXOS.GERAL, // Extensão
  ICP005: EIXOS.GERAL, // Ética em Computação
  ICP029: EIXOS.GERAL, // Empreendedorismo e Inovação
  ICP030: EIXOS.GERAL, // Governança e Gestão de Dados
  ICP100: EIXOS.GERAL, // Gestão Estratégica de TI
  ICP103: EIXOS.GERAL, // Análise de Risco
  ICP465: EIXOS.GERAL, // Informática e Sociedade
  ICP603: EIXOS.GERAL, // Gestão do Conhecimento
  ICP023: EIXOS.GERAL, // Gestão de Projetos
  CMT001: EIXOS.GERAL, // Estágio Dirigido
  NCG011: EIXOS.GERAL, // Acessando a Mente e o Espaço
  NEP142: EIXOS.GERAL, // Direitos Humanos
  LEB599: EIXOS.GERAL,
};

const PREFIXOS_EIXOS = [
  [/^MA[ED]/, EIXOS.TEORIA],
  [/^(NEP|FCF|IEE|LEB|NCG|CMT|FIM|FIT)/, EIXOS.GERAL],
  [/^(ICP|MAB)/, EIXOS.ENGENHARIA],
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
  return EIXOS.OUTROS;
}

/**
 * Agrupa as disciplinas concluídas por eixo e calcula métricas.
 * @param {object} historyData
 * @returns {Array<{eixo: string, cr: number, crRComGrau: number, creditosTotais: number, total: number}>}
 */
export function calcularMetricasPorEixo(historyData) {
  const grupos = new Map();

  (historyData?.periodos || []).forEach((periodo) => {
    (periodo.disciplinas || []).forEach((d) => {
      const eixo = eixoDaDisciplina(d.codigo);
      if (!grupos.has(eixo)) {
        grupos.set(eixo, { eixo, pontos: 0, crRComGrau: 0, creditosTotais: 0, total: 0 });
      }
      const g = grupos.get(eixo);
      g.total += 1;
      const crR = Number(d.crR);
      if (!isNaN(crR)) g.creditosTotais += crR;
      if (disciplinaConferGrau(d)) {
        g.crRComGrau += crR || 0;
        g.pontos += Number(d.pontos) || (Number(d.grau) || 0) * (crR || 0);
      }
    });
  });

  return [...grupos.values()]
    .map((g) => ({ ...g, cr: g.crRComGrau ? g.pontos / g.crRComGrau : 0 }))
    .sort((a, b) => b.creditosTotais - a.creditosTotais);
}
