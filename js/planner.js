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

/** Re-renderiza toda a aba do planejador. */
function renderPlanner() {
  if (!containerEl) return;
  clearElement(containerEl);

  containerEl.appendChild(renderBanco());
  containerEl.appendChild(renderSemestres());
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
    planner.banco.push({ codigo: codigo || 'ELETIVA', nome: nome || codigo, crR, periodoRecomendado: null, status: 'manual' });
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
    const resumo = calcularCRDisciplinas(
      semestre.disciplinas.map((d) => ({
        crR: d.crR,
        grau: d.grau,
        pontos: d.grau != null ? d.grau * (Number(d.crR) || 0) : 0,
        situacao: d.grau != null && !isNaN(d.grau) ? (d.grau >= 5 ? 'AP' : 'RM') : 'Cursando',
      }))
    );

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
      planner.semestres[i].disciplinas.map((d) => ({
        crR: d.crR,
        grau: d.grau,
        pontos: d.grau != null ? d.grau * (Number(d.crR) || 0) : 0,
        situacao: d.grau != null && !isNaN(d.grau) ? (d.grau >= 5 ? 'AP' : 'RM') : 'Cursando',
      }))
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
