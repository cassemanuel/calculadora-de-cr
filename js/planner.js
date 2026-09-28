/**
 * Planejador de Matrícula e Conclusão de Curso.
 *
 * Permite importar as disciplinas pendentes do BOA (Boletim de Orientação
 * Acadêmica), organizar o banco de pendências em semestres futuros e
 * projetar o CR previsto de cada período e o CR acumulado ao seu término.
 *
 * Estrutura persistida:
 *   {
 *     banco:     [{ codigo, nome, crR, periodoRecomendado, status }],
 *     semestres: [{ rotulo: '2026/2', disciplinas: [{ codigo, nome, crR, grau }] }]
 *   }
 */

import { processarBOA } from './boaParser.js';
import {
  calcularCRAcumulado,
  calcularCRDisciplinas,
  calcularMetaReversa,
  disciplinaConferGrau,
} from './calculator.js';
import { eixoDaDisciplina, EIXOS } from './eixos.js';
import { loadPlanner, savePlanner } from './storage.js';
import {
  el,
  clearElement,
  formatNumberBR,
  parseNumberBR,
  validatePdfFile,
} from './ui.js';

// Limites regulamentares de créditos por período no SIGA.
const LIMITE_CREDITOS = Object.freeze({ MIN: 8, MAX: 28 });

const CREDITOS_ELETIVA = 4;
const NOTA_MAXIMA = 10;
const NOTA_MINIMA = 0;

// Metas curriculares de eletivas do PPC 2022, usadas para gerar placeholders
// genéricos no banco de pendências (o BOA lista optativas pelo código, o que
// poluiria o planejamento — aqui contamos vagas restantes por categoria).
const METAS_ELETIVAS = Object.freeze([
  { codigo: 'ELETIVA-COND', nome: 'Eletiva Condicionada (Falta)', total: 8 },
  { codigo: 'ELETIVA-HUM', nome: 'Eletiva de Humanas (Falta)', total: 1 },
  { codigo: 'ELETIVA-LIVRE', nome: 'Eletiva Livre (Falta)', total: 2 },
]);

const PERIODO_REGEX = /^(\d{4})\s*\/\s*(\d)$/;

// Mapa oficial de pré-requisitos por código de disciplina, extraído das
// tabelas do PPC 2022 do BCC/UFRJ — códigos separados por vírgula.
const MAPA_REQUISITOS = Object.freeze({
  // 1º Período (sem pré-requisitos)
  ICP131: '',
  ICP132: '',
  ICP133: '',
  ICP134: '',
  ICP135: '',
  ICP136: '',

  // 2º Período
  ICP141: 'ICP131',
  ICP142: '',
  ICP143: 'ICP131, ICP132, ICP133',
  ICP144: 'ICP134',
  ICP145: 'ICP135',
  MAE111: '',

  // 3º Período
  ICP115: 'ICP136, ICP144',
  ICP116: 'ICP141',
  ICP211: 'ICP132, ICP141',
  ICP237: 'ICP132, ICP141',
  ICP212: 'ICP131, ICP133, MAE111',
  ICP238: 'ICP131, ICP133, MAE111',
  ICP213: 'ICP141',
  ICP239: 'ICP141',
  MAE992: 'MAE111',

  // 4º Período
  ICP251: 'ICP133, ICP141',
  ICP246: 'ICP133, ICP141',
  ICP252: 'ICP115, ICP238, MAE992',
  ICP248: 'ICP115, ICP238, MAE992',
  ICP253: 'ICP145',
  ICP249: 'ICP145',
  ICP489: 'ICP116',
  MAD243: 'MAE992',

  // 5º Período
  ICP123: 'ICP141, ICP144',
  ICP311: 'ICP115, MAD243',
  ICP350: 'ICP115, MAD243',
  ICP312: 'ICP115, MAE992',
  ICP351: 'ICP115, MAE992',
  ICP353: 'ICP246',
  ICP368: 'ICP116, ICP144',

  // 6º Período
  ICP321: 'ICP239, ICP353',
  ICP361: 'ICP239, ICP353',
  ICP322: 'ICP131, ICP133, MAD243',
  ICP362: 'ICP131, ICP133, MAD243',
  ICP323: 'ICP248, MAD243',
  ICP363: 'ICP248, MAD243',
  ICP325: 'ICP115, ICP238',
  ICP365: 'ICP115, ICP238',
  ICP324: 'ICP123',
  ICP370: 'ICP123',

  // 7º Período
  ICP411: 'ICP353, ICP362',
  ICP473: 'ICP353, ICP362',
  ICP412: 'ICP249',
  ICP472: 'ICP249',

  // 8º Período
  ICPK01: 'ICP472',

  // Optativas Condicionadas Frequentes
  ICP622: 'ICP361',
  ICP095: '',
  ICP006: 'ICP246, ICP362',
  ICP508: 'ICP368',
  ICP471: 'ICP116, ICP123, ICP353',
  ICP478: 'ICP238',
  MAE993: 'MAE992',
  MAE994: 'ICP115, MAE992',
  FIT112: '',
  FIT122: 'FIT112, MAE111',
  FIM230: 'FIT112, MAE992',
  FIM240: 'FIM230',
});

let containerEl = null;
let getHistoryData = () => null;
let planner = { banco: [], semestres: [] };

/**
 * Inicializa a aba do Planejador de Matrícula.
 * @param {() => object|null} historyGetter Função que retorna o histórico atual.
 */
export function initPlanner(historyGetter) {
  getHistoryData = typeof historyGetter === 'function' ? historyGetter : () => null;
  containerEl = document.getElementById('planner-content');
  document
    .getElementById('export-planner')
    ?.addEventListener('click', exportarPlanejamento);
  refreshPlanner();
}

/**
 * Recarrega o planejamento do armazenamento e re-renderiza a aba.
 * Usado quando o histórico muda ou um JSON com planejamento é importado.
 */
export function refreshPlanner() {
  if (!containerEl) return;
  const salvo = loadPlanner();
  planner = salvo || { banco: [], semestres: [] };
  if (!planner.semestres.length) {
    planner.semestres.push({ rotulo: proximoRotulo(), disciplinas: [] });
  }
  renderPlanner();
}

/**
 * Retorna o estado atual do planejador (para inclusão no JSON exportado).
 * @returns {{banco: Array<object>, semestres: Array<object>}}
 */
export function getPlannerData() {
  return planner;
}

/**
 * Calcula o rótulo do próximo período letivo (ex.: "2026/1" → "2026/2",
 * "2026/2" → "2027/1"). Parte do último período do histórico ou da data atual.
 * @param {string} [base] Rótulo de período de referência.
 * @returns {string}
 */
function proximoRotulo(base) {
  const referencia = base || ultimoPeriodoHistorico() || periodoAtual();
  const match = String(referencia).match(PERIODO_REGEX);
  const ano = match ? parseInt(match[1], 10) : new Date().getFullYear();
  const sem = match ? parseInt(match[2], 10) : 0;
  return sem >= 2 ? `${ano + 1}/1` : `${ano}/2`;
}

function ultimoPeriodoHistorico() {
  const periodos = getHistoryData()?.periodos || [];
  const ultimo = periodos[periodos.length - 1]?.periodo;
  return PERIODO_REGEX.test(String(ultimo || '')) ? ultimo : null;
}

function periodoAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}/${agora.getMonth() >= 6 ? 2 : 1}`;
}

function persistir() {
  savePlanner(planner);
}

/**
 * Converte uma disciplina do planejador ({codigo, nome, crR, grau}) para o
 * formato esperado pelo motor de cálculo (situacao/pontos derivados do grau).
 * @param {object} d
 * @returns {object}
 */
function paraCalculo(d) {
  const temNota = d.grau != null && !isNaN(Number(d.grau));
  return {
    crR: d.crR,
    grau: d.grau,
    pontos: temNota ? Number(d.grau) * (Number(d.crR) || 0) : 0,
    situacao: temNota ? (d.grau >= 5 ? 'AP' : 'RM') : 'Cursando',
  };
}

/** Re-renderiza toda a aba do planejador. */
function renderPlanner() {
  if (!containerEl) return;
  clearElement(containerEl);

  containerEl.appendChild(renderBanco());
  containerEl.appendChild(renderSemestres());
  containerEl.appendChild(renderMetaReversa());
}

/* ============================================================
   Banco de Pendências
   ============================================================ */

function renderBanco() {
  const lista = el(
    'div',
    { className: 'planner-banco-lista' },
    planner.banco.length
      ? planner.banco.map((d, index) => renderItemBanco(d, index))
      : [
          el('p', { className: 'text-muted' },
            'Nenhuma pendência no banco. Importe do BOA ou adicione manualmente.'),
        ]
  );

  const inputBoa = el('input', {
    type: 'file',
    accept: '.pdf,application/pdf',
    hidden: true,
    'aria-label': 'Selecionar PDF do BOA',
    onchange: (e) => importarBOA(e.target),
  });

  const campoCodigo = el('input', { type: 'text', placeholder: 'Código', 'aria-label': 'Código da disciplina' });
  const campoNome = el('input', { type: 'text', placeholder: 'Nome da disciplina', 'aria-label': 'Nome da disciplina' });
  const campoCrR = el('input', { type: 'text', placeholder: 'CrR', 'aria-label': 'Créditos' });

  const adicionarManual = () => {
    const codigo = campoCodigo.value.trim().toUpperCase();
    const nome = campoNome.value.trim();
    const crR = parseNumberBR(campoCrR.value);
    if (!codigo && !nome) return;
    if (codigoExiste(codigo)) return;
    planner.banco.push({ codigo: codigo || 'ELETIVA', nome: nome || codigo, crR, requisitos: MAPA_REQUISITOS[codigo] || '', periodoRecomendado: null, status: 'manual' });
    campoCodigo.value = '';
    campoNome.value = '';
    campoCrR.value = '';
    persistir();
    renderPlanner();
  };

  [campoCodigo, campoNome, campoCrR].forEach((campo) =>
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') adicionarManual();
    })
  );

  return el('section', { className: 'card planner-banco' }, [
    el('h3', {}, 'Banco de Pendências'),
    el('p', { className: 'text-muted' },
      'Disciplinas pendentes aguardando alocação em um semestre.'),
    el('div', { className: 'actions-row' }, [
      el(
        'label',
        { className: 'btn btn-secondary' },
        [el('i', { className: 'bi bi-file-earmark-pdf', 'aria-hidden': 'true' }), ' Importar Pendências do BOA', inputBoa]
      ),
      el('button', {
        className: 'btn btn-danger',
        type: 'button',
        onclick: () => {
          if (confirm('Deseja limpar todo o planejamento atual (banco e semestres futuros)?')) {
            planner.banco = [];
            planner.semestres = [{ rotulo: proximoRotulo(), disciplinas: [] }];
            persistir();
            renderPlanner();
          }
        },
      }, [el('i', { className: 'bi bi-trash', 'aria-hidden': 'true' }), ' Limpar Planejamento']),
    ]),
    el('div', { className: 'planner-add-row' }, [
      campoCodigo,
      campoNome,
      campoCrR,
      el('button', {
        className: 'btn btn-primary',
        type: 'button',
        onclick: adicionarManual,
      }, [el('i', { className: 'bi bi-plus-lg', 'aria-hidden': 'true' }), ' Adicionar Matéria Manual']),
    ]),
    lista,
  ]);
}

function codigoExiste(codigo) {
  if (!codigo) return false;
  const alocadas = planner.semestres.flatMap((s) => s.disciplinas);
  return [...planner.banco, ...alocadas].some(
    (d) => String(d.codigo || '').toUpperCase() === codigo
  );
}

function renderItemBanco(disciplina, index) {
  const select = el('select', {
    'aria-label': `Alocar ${disciplina.codigo || 'disciplina'} para semestre`,
    onchange: (e) => {
      const alvo = parseInt(e.target.value, 10);
      if (!isNaN(alvo)) alocarDisciplina(index, alvo);
    },
  }, [
    el('option', { value: '' }, 'Alocar para…'),
    ...planner.semestres.map((s, i) => el('option', { value: String(i) }, s.rotulo)),
  ]);

  return el('div', { className: 'planner-item' }, [
    el('div', { className: 'planner-item-info' }, [
      el('strong', {}, disciplina.codigo || '—'),
      el('span', { className: 'planner-item-nome' }, disciplina.nome || '—'),
      el('span', { className: 'text-muted' },
        `${formatNumberBR(disciplina.crR, 0)} cr${disciplina.periodoRecomendado ? ` · ${disciplina.periodoRecomendado}º período` : ''}`),
    ]),
    select,
    el('button', {
      className: 'btn btn-icon btn-danger',
      type: 'button',
      'aria-label': `Remover ${disciplina.codigo || 'disciplina'} do banco`,
      title: 'Remover do banco',
      onclick: () => {
        planner.banco.splice(index, 1);
        persistir();
        renderPlanner();
      },
    }, [el('i', { className: 'bi bi-trash', 'aria-hidden': 'true' })]),
  ]);
}

function alocarDisciplina(indexBanco, indexSemestre) {
  const disciplina = planner.banco[indexBanco];
  const semestre = planner.semestres[indexSemestre];
  if (!disciplina || !semestre) return;
  planner.banco.splice(indexBanco, 1);
  semestre.disciplinas.push({ ...disciplina, grau: disciplina.grau ?? null });
  persistir();
  renderPlanner();
}

async function importarBOA(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    validatePdfFile(file);
    const arrayBuffer = await file.arrayBuffer();
    // Apenas obrigatórias pendentes são importadas — as optativas do BOA
    // viram placeholders genéricos de eletivas (ver adicionarEletivasFaltantes).
    const { obrigatorias } = await processarBOA(arrayBuffer);

    let adicionadas = 0;
    obrigatorias.forEach((d) => {
      if (codigoExiste(String(d.codigo || '').toUpperCase())) return;
      planner.banco.push({
        codigo: d.codigo,
        nome: d.nome,
        crR: d.crR,
        requisitos: MAPA_REQUISITOS[String(d.codigo || '').toUpperCase()] || '',
        periodoRecomendado: d.periodoRecomendado ?? null,
        status: d.status || 'pendente',
      });
      adicionadas += 1;
    });

    adicionadas += adicionarEletivasFaltantes();

    persistir();
    renderPlanner();
    if (!adicionadas) alert('Nenhuma disciplina pendente nova encontrada no BOA.');
  } catch (err) {
    console.error(err);
    alert(err.message || 'Erro ao processar o BOA.');
  } finally {
    input.value = '';
  }
}

/**
 * Conta quantas eletivas já existem no planejamento (banco ou semestres)
 * em uma categoria de placeholder.
 * @param {string} codigoBase Prefixo do código do placeholder.
 * @returns {number}
 */
function contarPlaceholders(codigoBase) {
  const todas = [
    ...planner.banco,
    ...planner.semestres.flatMap((s) => s.disciplinas),
  ];
  return todas.filter((d) => String(d.codigo || '').startsWith(codigoBase)).length;
}

/**
 * Conta as eletivas já concluídas no histórico: disciplinas que conferem
 * grau e caem no eixo Eletivas (fora do núcleo obrigatório do PPC).
 * @returns {number}
 */
function contarEletivasConcluidas() {
  const periodos = getHistoryData()?.periodos || [];
  return periodos
    .flatMap((p) => p.disciplinas || [])
    .filter(
      (d) => disciplinaConferGrau(d) && eixoDaDisciplina(d.codigo) === EIXOS.ELETIVAS
    ).length;
}

/**
 * Insere no banco placeholders genéricos das eletivas que ainda faltam,
 * subtraindo das metas curriculares as eletivas já concluídas no histórico
 * e os placeholders já existentes no planejamento. As eletivas concluídas
 * abatem primeiro as condicionadas, depois as de humanas e por último as livres.
 * @returns {number} Quantidade de placeholders adicionados.
 */
function adicionarEletivasFaltantes() {
  let concluidasRestantes = contarEletivasConcluidas();
  let adicionadas = 0;

  METAS_ELETIVAS.forEach((meta) => {
    const existentes = contarPlaceholders(meta.codigo);
    const abatidas = Math.min(meta.total - existentes, concluidasRestantes);
    concluidasRestantes -= Math.max(0, abatidas);
    const faltam = meta.total - existentes - Math.max(0, abatidas);

    for (let i = 0; i < faltam; i++) {
      planner.banco.push({
        codigo: `${meta.codigo}-${existentes + i + 1}`,
        nome: meta.nome,
        crR: CREDITOS_ELETIVA,
        periodoRecomendado: null,
        status: 'pendente',
      });
      adicionadas += 1;
    }
  });

  return adicionadas;
}

/* ============================================================
   Semestres futuros
   ============================================================ */

function renderSemestres() {
  const base = calcularCRAcumulado(getHistoryData(), []);

  let pontosAcumulados = base.pontosTotais;
  let crRAcumulado = base.crRComGrau;

  const cards = planner.semestres.map((semestre, index) => {
    const resumo = calcularCRDisciplinas(semestre.disciplinas.map(paraCalculo));

    pontosAcumulados += resumo.pontosTotais;
    crRAcumulado += resumo.crRComGrau;
    const crProjetado = crRAcumulado ? pontosAcumulados / crRAcumulado : 0;

    return renderSemestreCard(semestre, index, resumo, crProjetado);
  });

  return el('section', { className: 'planner-semestres' }, [
    el('div', { className: 'planner-semestres-header' }, [
      el('h3', {}, 'Semestres Futuros'),
      el('button', {
        className: 'btn btn-primary',
        type: 'button',
        onclick: () => {
          planner.semestres.push({ rotulo: proximoRotulo(planner.semestres.at(-1)?.rotulo), disciplinas: [] });
          persistir();
          renderPlanner();
        },
      }, [el('i', { className: 'bi bi-plus-lg', 'aria-hidden': 'true' }), ' Adicionar Novo Semestre']),
    ]),
    el('div', { className: 'planner-grid' }, cards),
  ]);
}

function renderSemestreCard(semestre, index, resumo, crProjetado) {
  const creditos = semestre.disciplinas.reduce(
    (sum, d) => sum + (Number(d.crR) || 0),
    0
  );
  const foraDoLimite = creditos > LIMITE_CREDITOS.MAX ||
    (semestre.disciplinas.length > 0 && creditos < LIMITE_CREDITOS.MIN);

  const linhas = semestre.disciplinas.map((d, i) =>
    el('div', { className: 'planner-disc' }, [
      el('div', { className: 'planner-item-info' }, [
        el('strong', {}, d.codigo || '—'),
        el('span', { className: 'planner-item-nome' }, d.nome || '—'),
        el('span', { className: 'text-muted' }, `${formatNumberBR(d.crR, 0)} cr`),
      ]),
      el('input', {
        type: 'text',
        className: 'planner-nota',
        value: d.grau ?? '',
        placeholder: 'Nota',
        'aria-label': `Nota estimada para ${d.codigo || 'disciplina'}`,
        oninput: (e) => {
          const valor = e.target.value.trim();
          if (valor === '') {
            d.grau = null;
          } else {
            let nota = parseNumberBR(valor);
            // Trava física: notas fora de [0, 10] são reajustadas no campo.
            if (!isNaN(nota) && (nota > NOTA_MAXIMA || nota < NOTA_MINIMA)) {
              nota = Math.min(NOTA_MAXIMA, Math.max(NOTA_MINIMA, nota));
              e.target.value = String(nota);
            }
            d.grau = isNaN(nota) ? null : nota;
          }
          persistir();
          atualizarRodapeSemestre(index);
        },
      }),
      el('button', {
        className: 'btn btn-icon btn-secondary',
        type: 'button',
        'aria-label': `Devolver ${d.codigo || 'disciplina'} ao banco`,
        title: 'Devolver ao banco de pendências',
        onclick: () => {
          semestre.disciplinas.splice(i, 1);
          planner.banco.push(d);
          persistir();
          renderPlanner();
        },
      }, [el('i', { className: 'bi bi-arrow-counterclockwise', 'aria-hidden': 'true' })]),
    ])
  );

  return el('div', { className: 'card planner-semestre' }, [
    el('div', { className: 'planner-semestre-header' }, [
      el('input', {
        type: 'text',
        className: 'planner-rotulo',
        value: semestre.rotulo,
        'aria-label': 'Rótulo do semestre',
        oninput: (e) => {
          semestre.rotulo = e.target.value;
          persistir();
        },
      }),
      el('button', {
        className: 'btn btn-icon btn-danger',
        type: 'button',
        'aria-label': `Remover semestre ${semestre.rotulo}`,
        title: 'Remover semestre (disciplinas voltam ao banco)',
        onclick: () => {
          planner.banco.push(...semestre.disciplinas);
          planner.semestres.splice(index, 1);
          persistir();
          renderPlanner();
        },
      }, [el('i', { className: 'bi bi-trash', 'aria-hidden': 'true' })]),
    ]),
    semestre.disciplinas.length
      ? el('div', { className: 'planner-disc-lista' }, linhas)
      : el('p', { className: 'text-muted' }, 'Semestre vazio — aloque disciplinas do banco.'),
    el('div', { className: 'planner-semestre-footer', id: `planner-footer-${index}` }, [
      el('p', { className: `planner-creditos ${foraDoLimite ? 'credit-warning' : ''}` }, [
        `Créditos: ${formatNumberBR(creditos, 0)}`,
        foraDoLimite
          ? ` (fora do limite ${LIMITE_CREDITOS.MIN}–${LIMITE_CREDITOS.MAX} cr)`
          : '',
      ]),
      el('p', {}, `CR previsto: ${formatNumberBR(resumo.crCalculado, 2)}`),
      el('p', { className: 'planner-cr-projetado' },
        `CR acumulado projetado: ${formatNumberBR(crProjetado, 3)}`),
    ]),
  ]);
}

/**
 * Recalcula e atualiza o rodapé de um único semestre sem re-renderizar a aba
 * inteira (mantém o foco no input de nota durante a digitação).
 * @param {number} index
 */
function atualizarRodapeSemestre(index) {
  const semestre = planner.semestres[index];
  const footer = document.getElementById(`planner-footer-${index}`);
  if (!semestre || !footer) return;

  const base = calcularCRAcumulado(getHistoryData(), []);
  let pontosAcumulados = base.pontosTotais;
  let crRAcumulado = base.crRComGrau;

  for (let i = 0; i <= index; i++) {
    const resumo = calcularCRDisciplinas(
      planner.semestres[i].disciplinas.map(paraCalculo)
    );
    pontosAcumulados += resumo.pontosTotais;
    crRAcumulado += resumo.crRComGrau;
    if (i === index) {
      const creditos = planner.semestres[i].disciplinas.reduce(
        (sum, d) => sum + (Number(d.crR) || 0),
        0
      );
      const foraDoLimite = creditos > LIMITE_CREDITOS.MAX ||
        (planner.semestres[i].disciplinas.length > 0 && creditos < LIMITE_CREDITOS.MIN);
      const crProjetado = crRAcumulado ? pontosAcumulados / crRAcumulado : 0;

      clearElement(footer);
      footer.appendChild(el('p', { className: `planner-creditos ${foraDoLimite ? 'credit-warning' : ''}` },
        `Créditos: ${formatNumberBR(creditos, 0)}${foraDoLimite ? ` (fora do limite ${LIMITE_CREDITOS.MIN}–${LIMITE_CREDITOS.MAX} cr)` : ''}`));
      footer.appendChild(el('p', {}, `CR previsto: ${formatNumberBR(resumo.crCalculado, 2)}`));
      footer.appendChild(el('p', { className: 'planner-cr-projetado' },
        `CR acumulado projetado: ${formatNumberBR(crProjetado, 3)}`));
    }
  }
}

/* ============================================================
   Meta Reversa (média necessária nas disciplinas restantes)
   ============================================================ */

let metaReversaState = null;
let metaReversaResultEl = null;

/**
 * Card "Meta Reversa": calcula a média necessária nas disciplinas ainda sem
 * nota do planejamento para atingir um CR alvo.
 * @returns {HTMLElement}
 */
function renderMetaReversa() {
  metaReversaState = {
    crAlvoInput: el('input', { type: 'text', value: '7,0', 'aria-label': 'CR alvo' }),
  };
  metaReversaResultEl = el('p', { className: 'text-muted' },
    'Preencha o CR alvo para calcular a média necessária.');

  metaReversaState.crAlvoInput.addEventListener('input', updateMetaReversaResult);

  const card = el('div', { className: 'card planner-meta' }, [
    el('h4', {}, 'Meta Reversa'),
    el('p', { className: 'text-muted' },
      'Média necessária nas disciplinas pendentes do planejamento para atingir o CR alvo.'),
    el('div', { className: 'form-row' }, [
      el('label', {}, ['CR alvo: ', metaReversaState.crAlvoInput]),
    ]),
    metaReversaResultEl,
  ]);
  updateMetaReversaResult();
  return card;
}

/**
 * Recalcula a meta reversa considerando como "preenchidas" as disciplinas dos
 * semestres futuros com grau numérico válido, e como "restantes" tudo que está
 * no banco de pendências somado às disciplinas de semestres sem nota.
 */
function updateMetaReversaResult() {
  if (!metaReversaResultEl || !metaReversaState) return;

  const crAlvo = parseNumberBR(metaReversaState.crAlvoInput.value);
  if (Number.isNaN(crAlvo)) {
    metaReversaResultEl.textContent = 'Informe um CR alvo válido.';
    return;
  }

  const temNota = (d) => d.grau != null && d.grau !== '' && !isNaN(Number(d.grau));
  const disciplinasSemestres = planner.semestres.flatMap((s) => s.disciplinas);
  const disciplinasPreenchidas = disciplinasSemestres.filter(temNota).map(paraCalculo);
  const disciplinasRestantes = [
    ...planner.banco,
    ...disciplinasSemestres.filter((d) => !temNota(d)),
  ];

  const media = calcularMetaReversa(
    crAlvo,
    getHistoryData(),
    disciplinasPreenchidas,
    disciplinasRestantes
  );

  if (media === null) {
    metaReversaResultEl.textContent = 'Adicione disciplinas ao banco ou aos semestres para calcular a meta.';
    return;
  }

  if (media < 0) {
    metaReversaResultEl.textContent = `Nota necessária: ${formatNumberBR(media, 3)} (já está acima do CR alvo com as notas atuais).`;
  } else if (media > NOTA_MAXIMA) {
    metaReversaResultEl.textContent = `Nota necessária: ${formatNumberBR(media, 3)} (impossível atingir com apenas nota 10).`;
  } else {
    metaReversaResultEl.textContent = `Nota necessária nas disciplinas restantes: ${formatNumberBR(media, 3)}`;
  }
}

/* ============================================================
   Exportação do planejamento para impressão/PDF
   ============================================================ */

/**
 * Escapa caracteres HTML para injeção segura no documento de impressão.
 * @param {*} valor
 * @returns {string}
 */
function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Monta as linhas de uma tabela do relatório impresso.
 * @param {Array<object>} disciplinas
 * @returns {string}
 */
function linhasTabelaExport(disciplinas) {
  if (!disciplinas.length) {
    return '<tr><td colspan="4">Nenhuma disciplina neste bloco.</td></tr>';
  }
  return disciplinas
    .map((d) => {
      // Fallback: disciplinas salvas antes do mapa consultam MAPA_REQUISITOS.
      const req = d.requisitos || d.requisito || MAPA_REQUISITOS[String(d.codigo || '').toUpperCase()] || '—';
      return `<tr>
        <td>${escapeHtml(d.codigo || '—')}</td>
        <td>${escapeHtml(d.nome || '—')}</td>
        <td>${escapeHtml(formatNumberBR(d.crR, 0))}</td>
        <td>${escapeHtml(req)}</td>
      </tr>`;
    })
    .join('');
}

/**
 * Abre uma janela de impressão com o relatório do planejamento: resumo do
 * aluno (metadados do histórico) e um bloco por semestre futuro — numerado
 * pelo ordinal relativo à trajetória (N períodos letivos já cursados) —
 * seguido do bloco de disciplinas ainda não alocadas do banco de pendências.
 */
function exportarPlanejamento() {
  const win = window.open('', '_blank');
  if (!win) {
    alert('O navegador bloqueou a janela de impressão. Libere pop-ups para exportar.');
    return;
  }

  const metadata = getHistoryData()?.metadata || {};

  // Nome sugerido para o PDF: PRIMEIRONOME_DRE_YYYYMMDD_HHMM.
  const primeiroNome = (metadata.nome || 'ALUNO').split(' ')[0].toUpperCase();
  const dreStr = metadata.dre || 'SEMDRE';
  const dataAtual = new Date();
  const timestamp = dataAtual.getFullYear().toString() +
    String(dataAtual.getMonth() + 1).padStart(2, '0') +
    String(dataAtual.getDate()).padStart(2, '0') + '_' +
    String(dataAtual.getHours()).padStart(2, '0') +
    String(dataAtual.getMinutes()).padStart(2, '0');
  const docTitle = `${primeiroNome}_${dreStr}_${timestamp}`;

  // Remove o código do curso que o SIGA prefixa (ex.: "85783 - Bacharelado...").
  const cursoLimpo = (metadata.curso || 'Ciência da Computação — IC/UFRJ')
    .replace(/^\d+\s*-\s*/, '');

  // Períodos letivos regulares já cursados (ignora blocos de transferência
  // como "2023", que não seguem o padrão "AAAA/N").
  const periodosCursados = (getHistoryData()?.periodos || []).filter((p) =>
    PERIODO_REGEX.test(String(p.periodo || ''))
  ).length;

  const creditosDe = (disciplinas) =>
    disciplinas.reduce((sum, d) => sum + (Number(d.crR) || 0), 0);

  const bloco = (titulo, disciplinas) => `
  <section class="semestre-bloco">
    <h3 class="semestre-titulo">${titulo}
      <span class="semestre-creditos">${escapeHtml(formatNumberBR(creditosDe(disciplinas), 0))} créditos</span>
    </h3>
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Nome</th>
          <th>Créditos</th>
          <th>Pré-requisitos</th>
        </tr>
      </thead>
      <tbody>
        ${linhasTabelaExport(disciplinas)}
      </tbody>
    </table>
  </section>`;

  const blocosSemestres = planner.semestres
    .map((s, i) =>
      bloco(
        `${escapeHtml(s.rotulo)} — ${periodosCursados + i + 1}º Período`,
        s.disciplinas
      )
    )
    .join('');

  const blocoBanco = planner.banco.length
    ? bloco('Disciplinas Pendentes (Ainda não alocadas)', planner.banco)
    : '';

  const docHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docTitle)}</title>
  <link rel="stylesheet" href="css/styles.css" />
  <style>
    body {
      background: #ffffff;
      padding: 24px;
      font-family: "Open Sans", sans-serif;
      color: #0f172a;
    }
    .grade-export-title {
      margin: 0 auto 20px auto;
      font-family: "Montserrat", sans-serif;
      text-align: center;
    }
    .grade-export-title h2 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #1e293b;
      text-transform: uppercase;
    }
    .grade-export-summary {
      background: #f8fafc;
      border: 2px solid #344563;
      border-radius: 12px;
      padding: 18px 22px;
      box-sizing: border-box;
      font-family: "Montserrat", sans-serif;
      margin-bottom: 24px;
    }
    .grade-export-summary-id h2 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 800;
      color: #1e293b;
    }
    .grade-export-summary-id p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #475569;
    }
    .grade-export-summary-tags {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .grade-export-summary-tags small {
      color: #64748b;
      font-size: 11px;
    }
    .dre-tag {
      display: inline-block;
      background: #344563;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .semestre-bloco {
      margin-bottom: 20px;
    }
    .semestre-titulo {
      font-family: "Montserrat", sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #344563;
      border-bottom: 2px solid #344563;
      padding-bottom: 6px;
      margin: 0 0 8px 0;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    .semestre-creditos {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      font-family: "Montserrat", sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    @media print {
      .semestre-bloco {
        page-break-inside: avoid;
        margin-bottom: 24px;
      }
    }
  </style>
</head>
<body>
  <header class="grade-export-title">
    <h2>Planejamento Pedagógico</h2>
  </header>
  <div class="grade-export-summary">
    <div class="grade-export-summary-main">
      <div class="grade-export-summary-id">
        <h2>${escapeHtml(metadata.nome || 'Aluno')}</h2>
        <p>${escapeHtml(cursoLimpo)}</p>
        <div class="grade-export-summary-tags">
          ${metadata.dre ? `<span class="dre-tag">DRE ${escapeHtml(metadata.dre)}</span>` : ''}
          <small>Gerado em ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}</small>
        </div>
      </div>
    </div>
  </div>
  <div class="grade-export-disclaimers" style="font-size: 13px; color: #334155; margin-bottom: 24px; line-height: 1.5;">
    <strong>Planejamento do Curso – Bacharelado em Ciência da Computação</strong>
    <ol style="margin-top: 8px; padding-left: 24px;">
      <li>Este planejamento deve incluir todas as disciplinas que faltam para você concluir o curso, indicando em qual período você pretende cursá-las.</li>
      <li>No caso das disciplinas eletivas, basta você colocar na tabela como “ELETIVA”, não precisa indicar qual é. Quando você cursar mais de uma eletiva em um período, coloque uma linha para cada eletiva.</li>
      <li>No caso das horas de extensão, indique também qual a carga horária de extensão que você pretende cumprir no período. Por exemplo: “EXTENSÃO – 60 horas” informa que você pretende cumprir 60 horas de extensão em um determinado período.</li>
      <li>Caso seja necessário, acrescente mais períodos.</li>
    </ol>
  </div>
  ${blocosSemestres}
  ${blocoBanco}
  <script>
    window.onload = () => { window.print(); window.close(); };
  <\/script>
</body>
</html>`;

  win.document.open();
  win.document.write(docHtml);
  win.document.close();
}
