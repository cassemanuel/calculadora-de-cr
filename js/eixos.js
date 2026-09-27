/**
 * Classificação das disciplinas do BCC/UFRJ por eixos temáticos,
 * calibrada conforme as grandes áreas formativas do PPC 2022/2.
 *
 * O mapa cobre os códigos do currículo novo (2022/2) e os códigos
 * equivalentes do currículo antigo. O fallback por prefixo classifica
 * disciplinas de outras unidades; o que sobrar cai em "Livre Escolha"
 * (eixo do PPC para disciplinas fora do elenco do BCC).
 */

import { disciplinaConferGrau } from './calculator.js';

export const EIXOS = {
  TEORIA: 'Teoria da Computação e Matemática',
  SISTEMAS: 'Sistemas Computacionais e Comunicação',
  ENGENHARIA: 'Engenharia de Software e Aplicações',
  DADOS: 'Ciência de Dados e Computação Científica',
  GERAL: 'Formação Humana, Social e Complementar',
  LIVRE_ESCOLHA: 'Livre Escolha',
};

const MAPA_EIXOS = {
  // 1. Teoria da Computação e Matemática
  ICP144: EIXOS.TEORIA, // Matemática Discreta
  ICP115: EIXOS.TEORIA, // Álgebra Linear Algorítmica
  ICP123: EIXOS.TEORIA, // Linguagens Formais
  ICP368: EIXOS.TEORIA, // Algoritmos e Grafos
  ICP324: EIXOS.TEORIA,
  ICP370: EIXOS.TEORIA, // Lógica e Computabilidade
  ICP471: EIXOS.TEORIA, // Compiladores
  ICP478: EIXOS.TEORIA, // Métodos Numéricos I
  ICP518: EIXOS.TEORIA, // Teoria de Grafos
  ICP633: EIXOS.TEORIA, // Algoritmos de Aproximação
  ICP636: EIXOS.TEORIA, // Algoritmos Paralelos
  ICP638: EIXOS.TEORIA, // Computação Algébrica
  ICP639: EIXOS.TEORIA, // Computação Quântica
  ICP035: EIXOS.TEORIA, // Tóp Esp em Teoria da Comput I
  ICP036: EIXOS.TEORIA, // Tóp Esp em Teoria da Comput II
  MAB624: EIXOS.TEORIA, // Números Inteiros e Criptografia
  ICP134: EIXOS.TEORIA, // Números Inteiros e Criptografia (PPC 2022)
  MAE111: EIXOS.TEORIA, // Cálculo Infinitesimal I
  MAE992: EIXOS.TEORIA, // Cálculo Integ e Diferencial II
  MAE993: EIXOS.TEORIA, // Cálculo III
  MAE994: EIXOS.TEORIA, // Cálculo IV
  MAD243: EIXOS.TEORIA, // Estatística e Probabilidade

  // 2. Sistemas e Comunicação
  ICP133: EIXOS.SISTEMAS, // Fund de Sistemas de Computação
  MAB111: EIXOS.SISTEMAS, // Fund da Computação Digital
  MAB245: EIXOS.SISTEMAS, // Circuitos Lógicos
  ICP251: EIXOS.SISTEMAS,
  ICP246: EIXOS.SISTEMAS, // Arquitetura de Computadores e SO
  ICP321: EIXOS.SISTEMAS,
  ICP361: EIXOS.SISTEMAS, // Programação Concorrente
  ICP322: EIXOS.SISTEMAS,
  ICP362: EIXOS.SISTEMAS, // Redes de Computadores I
  ICP026: EIXOS.SISTEMAS, // Redes de Computadores II
  ICP411: EIXOS.SISTEMAS,
  ICP473: EIXOS.SISTEMAS, // Segurança da Informação
  ICP006: EIXOS.SISTEMAS, // Internet das Coisas
  ICP025: EIXOS.SISTEMAS, // Computação em Nuvem
  ICP027: EIXOS.SISTEMAS, // Criptografia
  ICP028: EIXOS.SISTEMAS, // Tóp Esp em Arquitetura
  ICP367: EIXOS.SISTEMAS, // Sistemas Distribuídos

  // 3. Engenharia de Software e Aplicações
  ICP131: EIXOS.ENGENHARIA, // Programação de Computadores I
  MAB120: EIXOS.ENGENHARIA, // Computação I (CC)
  ICP141: EIXOS.ENGENHARIA, // Programação de Computadores II
  ICP240: EIXOS.ENGENHARIA, // Computação II (CC)
  ICP116: EIXOS.ENGENHARIA, // Estruturas de Dados
  ICP132: EIXOS.ENGENHARIA, // Processos de Software
  MAB112: EIXOS.ENGENHARIA, // Sistemas de Informação
  ICP211: EIXOS.ENGENHARIA,
  ICP237: EIXOS.ENGENHARIA, // Introd à Modelagem de Sistemas
  ICP213: EIXOS.ENGENHARIA,
  ICP239: EIXOS.ENGENHARIA, // Programação Orientada a Objetos
  ICP489: EIXOS.ENGENHARIA, // Banco de Dados I
  ICP491: EIXOS.ENGENHARIA, // Banco de Dados II
  ICP041: EIXOS.ENGENHARIA,
  ICP042: EIXOS.ENGENHARIA,
  ICP142: EIXOS.ENGENHARIA,
  ICP143: EIXOS.ENGENHARIA, // Projeto Prático
  MAB113: EIXOS.ENGENHARIA, // Organização da Informação
  ICP353: EIXOS.ENGENHARIA, // Computadores e Programação
  ICP356: EIXOS.ENGENHARIA, // Organização de Dados II
  ICP357: EIXOS.ENGENHARIA, // Data Warehousing
  ICP359: EIXOS.ENGENHARIA, // Suporte à Decisão
  ICP020: EIXOS.ENGENHARIA, // Engenharia de Software
  ICP021: EIXOS.ENGENHARIA, // Tóp Esp em Engenharia de Dados I
  ICP022: EIXOS.ENGENHARIA, // Tóp Esp em Engenharia de Dados II
  ICP051: EIXOS.ENGENHARIA, // Tóp Esp em Eng de Software I
  ICP052: EIXOS.ENGENHARIA, // Tóp Esp em Eng de Software II
  ICP061: EIXOS.ENGENHARIA, // Desenvolvimento Web I
  ICP062: EIXOS.ENGENHARIA, // Desenvolvimento Web II
  ICP071: EIXOS.ENGENHARIA, // Tóp Esp em Sist Computacionais I
  ICP072: EIXOS.ENGENHARIA, // Tóp Esp em Sist Computacionais II
  ICP616: EIXOS.ENGENHARIA, // Interação Humano-Computador
  ICP640: EIXOS.ENGENHARIA, // Projeto e Teste de Software
  ICP472: EIXOS.ENGENHARIA, // Metodologia da Pesquisa

  // 4. Ciência de Dados e Computação Científica
  ICP252: EIXOS.DADOS,
  ICP248: EIXOS.DADOS, // Computação Científica e Análise de Dados
  ICP212: EIXOS.DADOS,
  ICP238: EIXOS.DADOS, // Introd à Computação Numérica
  ICP311: EIXOS.DADOS,
  ICP350: EIXOS.DADOS, // Modelagem e Avaliação de Desempenho
  ICP312: EIXOS.DADOS,
  ICP351: EIXOS.DADOS, // Modelagem Matemática e Computacional
  ICP323: EIXOS.DADOS,
  ICP363: EIXOS.DADOS, // Introd Aprendizado de Máquina
  ICP325: EIXOS.DADOS,
  ICP365: EIXOS.DADOS, // Otimização
  ICP095: EIXOS.DADOS, // Tóp Esp em Ciência da Computação V
  ICP011: EIXOS.DADOS, // Tóp Esp em Ciência de Dados I
  ICP012: EIXOS.DADOS, // Tóp Esp em Ciência de Dados II
  ICP013: EIXOS.DADOS, // Séries e Transformadas Computacionais
  ICP014: EIXOS.DADOS, // Computação Científica - EDO
  ICP015: EIXOS.DADOS, // Computação Científica - EDP
  ICP016: EIXOS.DADOS, // Introd Métodos Elementos Finitos
  ICP017: EIXOS.DADOS, // Otimização Linear
  ICP018: EIXOS.DADOS, // Otimização Não Linear
  ICP031: EIXOS.DADOS, // Tóp Esp em Comp Científica I
  ICP032: EIXOS.DADOS, // Tóp Esp em Comp Científica II
  ICP034: EIXOS.DADOS, // Análise de Redes Sociais
  ICP096: EIXOS.DADOS, // Lab Análise de Redes Sociais
  ICP102: EIXOS.DADOS, // Tecnologia para Grandes Volumes de Dados
  ICP532: EIXOS.DADOS, // Mineração de Dados
  ICP605: EIXOS.DADOS, // Recuperação de Informação
  ICP508: EIXOS.DADOS, // Inteligência Artificial

  // 5. Formação Humana, Social e Complementar
  ICP135: EIXOS.GERAL,
  ICP007: EIXOS.GERAL, // Projeto de Carreira
  ICP145: EIXOS.GERAL,
  ICP008: EIXOS.GERAL, // Habilidades Sociais para o Trabalho
  ICP253: EIXOS.GERAL,
  ICP354: EIXOS.GERAL, // Computadores e Sociedade
  ICP136: EIXOS.GERAL, // Introd Pensamento Dedutivo
  ICP005: EIXOS.GERAL, // Ética em Computação
  ICP009: EIXOS.GERAL, // Sist Colaborativos e Computação Social
  ICP010: EIXOS.GERAL, // Web Semântica
  ICP019: EIXOS.GERAL, // Álgebra Linear Aplicada
  ICP023: EIXOS.GERAL, // Gestão de Projetos
  ICP024: EIXOS.GERAL, // Análise e Projeto de Sistemas
  ICP029: EIXOS.GERAL, // Empreendedorismo e Inovação
  ICP030: EIXOS.GERAL, // Governança e Gestão de Dados
  ICP100: EIXOS.GERAL, // Gestão Estratégica de TI
  ICP103: EIXOS.GERAL, // Análise de Risco
  ICP465: EIXOS.GERAL, // Informática e Sociedade
  ICP603: EIXOS.GERAL, // Gestão do Conhecimento
  ICPK01: EIXOS.GERAL, // Trabalho de Conclusão de Curso
  ICPX03: EIXOS.GERAL, // Monitoria
  ICPX04: EIXOS.GERAL,
  ICPX06: EIXOS.GERAL, // Atividades Complementares
  ICPZ55: EIXOS.GERAL, // Extensão

  // 6. Equivalências históricas — códigos da grade antiga (MAB/legados)
  // atribuídos ao eixo da disciplina equivalente no PPC 2022.
  MAB352: EIXOS.TEORIA, // Matemática Combinatória -> ICP144 Matemática Discreta
  MAB115: EIXOS.TEORIA, // Álgebra Linear Algorítmica -> ICP115
  MAB123: EIXOS.TEORIA, // Linguagens Formais -> ICP123
  MAB368: EIXOS.TEORIA, // Algoritmos e Grafos -> ICP368
  MAB116: EIXOS.ENGENHARIA, // Estrutura de Dados -> ICP116
  MAB240: EIXOS.ENGENHARIA, // Computação II -> ICP239 POO
  MAB353: EIXOS.ENGENHARIA, // Computadores e Programação -> ICP353
  MAB489: EIXOS.ENGENHARIA, // Bancos de Dados -> ICP489
  MAB230: EIXOS.DADOS, // Cálculo Numérico -> ICP238/ICP248
  MAB515: EIXOS.DADOS, // Avaliação e Desempenho -> ICP350
  MAB355: EIXOS.SISTEMAS, // Arquitetura de Computadores -> ICP246
  MAB366: EIXOS.SISTEMAS, // Sistemas Operacionais -> ICP246
  MAB117: EIXOS.SISTEMAS, // Computação/Programação Concorrente -> ICP361
  ICP510: EIXOS.SISTEMAS, // Teleprocessamento e Redes -> ICP362
  ICP232: EIXOS.DADOS, // Programação Linear -> ICP365
  ICP236: EIXOS.TEORIA, // Lógica -> ICP370 Lógica e Computabilidade
  ICP004: EIXOS.DADOS, // Aprendizado de Máquina -> ICP363
};

// Prefixos de unidades fora do rol do BCC (Física, Letras, outros centros)
// caem no fallback e são classificados como Livre Escolha.
const PREFIXOS_EIXOS = [
  [/^MA[ED]/, EIXOS.TEORIA],
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
  return EIXOS.LIVRE_ESCOLHA;
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
      const eixo = eixoDaDisciplina(d.codigo);
      if (!grupos.has(eixo)) {
        grupos.set(eixo, { eixo, pontos: 0, crRComGrau: 0, creditosTotais: 0, total: 0, disciplinas: [] });
      }
      const g = grupos.get(eixo);
      g.total += 1;
      g.disciplinas.push({ ...d, periodo: periodo.periodo });
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
