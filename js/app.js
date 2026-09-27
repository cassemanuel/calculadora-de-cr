import {
  loadThemePreference,
  saveThemePreference,
  loadHistory,
  saveHistory,
  clearHistory,
  exportJSON,
  importJSON,
} from './storage.js';
import { processarPDF } from './pdfParser.js';
import { processarBOA } from './boaParser.js';
import {
  calcularCRAcumulado,
  calcularCRDisciplinas,
  calcularMetaReversa,
  calcularImpactoCR,
} from './calculator.js';
import { el, badgeClassForSituacao, clearElement, parseNumberBR, formatNumberBR } from './ui.js';

// Estado global da aplicação.
const state = {
  historyData: null,
  simulatorDisciplinas: [],
};

function init() {
  configurePdfWorker();
  initTheme();
  initTabs();
  initDropzone();
  initDataActions();
  initSimulator();
  initQuickCalculator();

  // Carrega histórico salvo, se existir.
  const saved = loadHistory();
  if (saved) {
    state.historyData = saved;
    renderReport(document.getElementById('pdf-report'), saved);
  }
}

function configurePdfWorker() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } else {
    console.warn('pdf.js não carregado. O upload de PDF não funcionará.');
  }
}

function initTheme() {
  const preferredTheme = loadThemePreference();
  applyTheme(preferredTheme);

  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    saveThemePreference(newTheme);
  });
}

function applyTheme(theme) {
  const html = document.documentElement;
  const toggleBtn = document.getElementById('theme-toggle');
  const icon = toggleBtn?.querySelector('i');

  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
    if (icon) {
      icon.classList.remove('bi-sun-fill');
      icon.classList.add('bi-moon-stars-fill');
    }
    if (toggleBtn) toggleBtn.setAttribute('title', 'Mudar para tema claro');
  } else {
    html.removeAttribute('data-theme');
    if (icon) {
      icon.classList.remove('bi-moon-stars-fill');
      icon.classList.add('bi-sun-fill');
    }
    if (toggleBtn) toggleBtn.setAttribute('title', 'Mudar para tema escuro');
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      tabPanels.forEach((panel) => {
        if (panel.id === `tab-${targetTab}`) {
          panel.classList.add('active');
          panel.removeAttribute('hidden');
        } else {
          panel.classList.remove('active');
          panel.setAttribute('hidden', '');
        }
      });
    });
  });
}

function initDropzone() {
  const dropzone = document.getElementById('pdf-dropzone');
  const input = document.getElementById('pdf-input');
  const progress = document.getElementById('pdf-progress');
  const progressBar = document.getElementById('pdf-progress-bar');
  const report = document.getElementById('pdf-report');

  if (!dropzone || !input) return;

  ['dragenter', 'dragover'].forEach((event) => {
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((event) => {
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    handlePDFUpload(file, { progress, progressBar, report });
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    handlePDFUpload(file, { progress, progressBar, report });
  });
}

async function handlePDFUpload(file, { progress, progressBar, report }) {
  progress?.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '0%';

  const dropzoneLabel = document.querySelector('.dropzone-label span');
  const dropzoneHint = document.querySelector('.dropzone-hint');
  if (dropzoneLabel) dropzoneLabel.textContent = 'Processando...';

  // Evita que um cache antigo ou corrompido influencie o novo processamento.
  clearHistory();
  state.historyData = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = await processarPDF(arrayBuffer, (pct) => {
      if (progressBar) progressBar.style.width = `${Math.round(pct * 100)}%`;
    });

    data.resumo = calcularCRAcumulado(data);

    state.historyData = data;
    saveHistory(data);
    renderReport(report, data);

    if (dropzoneLabel) {
      dropzoneLabel.textContent = `${file.name} carregado com sucesso`;
    }
    if (dropzoneHint) {
      dropzoneHint.textContent = 'Relatório processado. Envie outro PDF para recomeçar.';
    }

    console.log('Histórico parseado:', data);
  } catch (err) {
    if (dropzoneLabel) {
      dropzoneLabel.textContent = 'Clique ou arraste o PDF aqui';
    }
    if (dropzoneHint) {
      dropzoneHint.textContent = 'PDF do SIGA/UFRJ (boletim ou histórico)';
    }
    console.error(err);
    showError(report, err.message);
  } finally {
    progress?.classList.add('hidden');
  }
}

function showError(container, message) {
  if (!container) return;
  clearElement(container);
  container.classList.remove('hidden');
  container.appendChild(
    el('div', { className: 'card' }, [
      el('h3', {}, 'Erro ao processar PDF'),
      el('p', { className: 'text-muted' }, message),
    ])
  );
}

function initDataActions() {
  const exportBtn = document.getElementById('export-json');
  const importInput = document.getElementById('import-json');
  const report = document.getElementById('pdf-report');

  exportBtn?.addEventListener('click', () => {
    if (!state.historyData) {
      alert('Nenhum histórico para exportar. Importe um PDF primeiro.');
      return;
    }
    exportJSON(state.historyData);
  });

  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const data = await importJSON(file);
      data.resumo = calcularCRAcumulado(data);
      state.historyData = data;
      saveHistory(data);
      renderReport(report, data);
    } catch (err) {
      alert(err.message);
    } finally {
      importInput.value = '';
    }
  });

  const clearBtn = document.getElementById('clear-data');
  clearBtn?.addEventListener('click', () => {
    if (confirm('Deseja apagar todos os dados salvos deste navegador?')) {
      clearHistory();
      state.historyData = null;
      state.simulatorDisciplinas = [];
      clearElement(report);
      report?.classList.add('hidden');
      initSimulator();
      alert('Dados salvos apagados.');
    }
  });
}

/* ============================================================
   Relatório de histórico
   ============================================================ */

function renderReport(container, data) {
  if (!container) return;
  clearElement(container);
  container.classList.remove('hidden');

  const { metadata, periodos, resumo } = data;

  const headerCards = el('div', { className: 'cards-grid' }, [
    renderMetadataCard(metadata),
    renderResumoCard(resumo),
  ]);
  container.appendChild(headerCards);

  if (periodos?.length) {
    const periodosSection = el('section', { className: 'periodos-list' }, [
      el('h3', {}, 'Disciplinas por Período'),
    ]);

    periodos.forEach((periodo, index) => {
      const periodosAteAqui = periodos.slice(0, index + 1);
      const crAcumulado = calcularCRAcumulado({ periodos: periodosAteAqui });
      periodosSection.appendChild(renderPeriodo(periodo, crAcumulado));
    });

    container.appendChild(periodosSection);
  }
}

function renderMetadataCard(metadata) {
  const lastPeriodo = state.historyData?.periodos?.length
    ? state.historyData.periodos[state.historyData.periodos.length - 1]?.periodo
    : null;
  const crAtual = state.historyData?.resumo?.crCalculado;

  const cursoLabel = metadata.curso
    ? el(
        'a',
        { href: 'https://siga.ufrj.br/sira/repositorio-curriculo/ListaCursos.html', target: '_blank', rel: 'noopener noreferrer' },
        'Curso:'
      )
    : 'Curso:';

  const items = [
    ['Nome', metadata.nome],
    ['DRE', metadata.dre],
    ['Ingresso', metadata.ingresso],
    ['Período atual', lastPeriodo],
    ['CR atual', crAtual != null ? formatNumberBR(crAtual, 3) : null],
    ['Emissão', metadata.emissao],
  ]
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => el('p', {}, [el('strong', {}, `${label}: `), value]));

  if (metadata.curso) {
    items.splice(2, 0, el('p', {}, [el('strong', {}, [cursoLabel, ' ']), metadata.curso]));
  }

  return el('div', { className: 'card' }, [el('h3', {}, 'Dados do Aluno'), ...items]);
}

function renderResumoCard(resumo) {
  return el('div', { className: 'card cr-dashboard' }, [
    el('h3', {}, 'Resumo do CR'),
    el('div', { className: 'cr-value' }, formatNumberBR(resumo.crCalculado, 3)),
    el('div', { className: 'cr-label' }, 'CR calculado'),
    el('div', { className: 'cr-details' }, [
      el('div', { className: 'cr-detail' }, [
        el('span', { className: 'cr-detail-value' }, formatNumberBR(resumo.crRComGrau, 1)),
        el('span', { className: 'cr-detail-label' }, 'Créditos com grau'),
      ]),
      el('div', { className: 'cr-detail' }, [
        el('span', { className: 'cr-detail-value' }, formatNumberBR(resumo.pontosTotais, 1)),
        el('span', { className: 'cr-detail-label' }, 'Pontos totais'),
      ]),
    ]),
  ]);
}

function renderPeriodo(periodo, crAcumuladoAteAqui) {
  const crPeriodo = calcularCRAcumulado({ periodos: [periodo] });
  const header = el('button', { className: 'periodo-header' }, [
    el('span', {}, periodo.periodo || 'Período não identificado'),
    el(
      'span',
      {},
      `CR período: ${formatNumberBR(crPeriodo.crCalculado, 3)} | CR acumulado: ${formatNumberBR(
        crAcumuladoAteAqui.crCalculado,
        3
      )} — ${periodo.disciplinas.length} disciplinas`
    ),
  ]);

  const table = el('table', {}, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, 'Código'),
        el('th', {}, 'Disciplina'),
        el('th', {}, 'CH'),
        el('th', {}, 'CrR'),
        el('th', {}, 'Grau'),
        el('th', {}, 'Pontos'),
        el('th', {}, 'SF'),
      ]),
    ]),
    el(
      'tbody',
      {},
      periodo.disciplinas.map((d) =>
        el('tr', { className: d.conferGrau ? '' : 'row-muted' }, [
          el('td', {}, d.codigo),
          el('td', {}, d.nome),
          el('td', {}, formatNumberBR(d.ch, 0)),
          el('td', {}, formatNumberBR(d.crR, 1)),
          el('td', {}, formatNumberBR(d.grau, 1)),
          el('td', {}, formatNumberBR(d.pontos, 1)),
          el('td', {}, [
            el('span', { className: `badge ${badgeClassForSituacao(d.situacao)}` }, d.situacao),
          ]),
        ])
      )
    ),
  ]);

  const body = el('div', { className: 'periodo-body hidden' }, [table]);

  header.addEventListener('click', () => {
    body.classList.toggle('hidden');
  });

  return el('div', { className: 'card periodo-card' }, [header, body]);
}

/* ============================================================
   Simulador de Período Atual
   ============================================================ */

// Referências aos elementos de resultado do simulador para atualização sem re-render.
let simulatorResultEls = null;
let metaReversaResultEl = null;
let simulatorTableBody = null;

function initSimulator() {
  const container = document.getElementById('pdf-simulator-content');
  if (!container) return;

  renderSimulatorUI(container);
  updateSimulatorResults();
}

function getBaseResumo() {
  return state.historyData?.resumo || { crRComGrau: 0, pontosTotais: 0, crCalculado: 0 };
}

function renderSimulatorUI(container) {
  clearElement(container);
  simulatorResultEls = {};
  metaReversaResultEl = null;
  simulatorTableBody = null;

  const actions = el('div', { className: 'actions-row' }, [
    el(
      'button',
      { className: 'btn btn-primary', type: 'button', onclick: () => addSimulatorRow(container) },
      [el('i', { className: 'bi bi-plus-lg' }), ' Adicionar disciplina']
    ),
    el(
      'button',
      { className: 'btn btn-secondary', type: 'button', onclick: () => importBOAForSimulator(container) },
      [el('i', { className: 'bi bi-file-earmark-pdf' }), ' Importar pendências do BOA']
    ),
    el(
      'button',
      { className: 'btn btn-danger', type: 'button', onclick: () => { state.simulatorDisciplinas = []; renderSimulatorUI(container); updateSimulatorResults(); } },
      [el('i', { className: 'bi bi-trash' }), ' Limpar']
    ),
  ]);

  const table = el('table', {}, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, 'Código'),
        el('th', {}, 'Nome'),
        el('th', {}, 'CrR'),
        el('th', {}, 'Nota prevista'),
        el('th', {}, 'Ações'),
      ]),
    ]),
    el('tbody', {}),
  ]);
  simulatorTableBody = table.querySelector('tbody');
  renderSimulatorTable();

  const tableContainer = el('div', { className: 'table-container' }, [table]);

  const resumo = el('div', { className: 'cards-grid' }, [
    el('div', { className: 'card' }, [
      el('h4', {}, 'CR do Período'),
      (simulatorResultEls.crPeriodo = el('p', {})),
    ]),
    el('div', { className: 'card' }, [
      el('h4', {}, 'Novo CR Acumulado'),
      (simulatorResultEls.novoCR = el('p', {})),
    ]),
    el('div', { className: 'card' }, [
      el('h4', {}, 'Impacto no CR'),
      (simulatorResultEls.impacto = el('p', {})),
    ]),
  ]);

  const metaSection = renderMetaReversa();

  container.appendChild(actions);
  container.appendChild(tableContainer);
  container.appendChild(resumo);
  container.appendChild(metaSection);
}

function renderSimulatorTable() {
  if (!simulatorTableBody) return;
  clearElement(simulatorTableBody);

  if (!state.simulatorDisciplinas.length) {
    simulatorTableBody.appendChild(
      el('tr', {}, [el('td', { colspan: 5, className: 'text-muted' }, 'Nenhuma disciplina adicionada.')])
    );
    return;
  }

  state.simulatorDisciplinas.forEach((disciplina, index) => {
    simulatorTableBody.appendChild(renderDisciplinaRow(disciplina, index));
  });
}

function updateDisciplinaField(index, field, value) {
  if (field === 'crR' || field === 'grau') {
    state.simulatorDisciplinas[index][field] = parseNumberBR(value);
    state.simulatorDisciplinas[index].pontos =
      state.simulatorDisciplinas[index].grau * state.simulatorDisciplinas[index].crR;
  } else {
    state.simulatorDisciplinas[index][field] = value;
  }
  state.simulatorDisciplinas[index].situacao = 'Cursando';
  state.simulatorDisciplinas[index].conferGrau = true;
  updateSimulatorResults();
}

function removeDisciplinaRow(index) {
  state.simulatorDisciplinas.splice(index, 1);
  renderSimulatorTable();
  updateSimulatorResults();
}

function renderDisciplinaRow(disciplina, index) {
  return el('tr', {}, [
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.codigo || '',
        placeholder: 'Código',
        oninput: (e) => updateDisciplinaField(index, 'codigo', e.target.value),
      }),
    ]),
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.nome || '',
        placeholder: 'Nome da disciplina',
        oninput: (e) => updateDisciplinaField(index, 'nome', e.target.value),
      }),
    ]),
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.crR || '',
        placeholder: 'CrR',
        oninput: (e) => updateDisciplinaField(index, 'crR', e.target.value),
      }),
    ]),
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.grau || '',
        placeholder: 'Nota',
        oninput: (e) => updateDisciplinaField(index, 'grau', e.target.value),
      }),
    ]),
    el('td', {}, [
      el(
        'button',
        { className: 'btn btn-danger', type: 'button', onclick: () => removeDisciplinaRow(index) },
        [el('i', { className: 'bi bi-trash' })]
      ),
    ]),
  ]);
}

function addSimulatorRow(container) {
  state.simulatorDisciplinas.push({
    codigo: '',
    nome: '',
    crR: 0,
    grau: 0,
    pontos: 0,
    situacao: 'Cursando',
    conferGrau: true,
  });
  renderSimulatorTable();
  updateSimulatorResults();
  // Foca o primeiro input da última linha adicionada.
  const lastRow = simulatorTableBody?.lastElementChild;
  lastRow?.querySelector('input')?.focus();
}

function updateSimulatorResults() {
  if (!simulatorResultEls) return;

  const baseResumo = getBaseResumo();
  const crPeriodo = calcularCRDisciplinas(state.simulatorDisciplinas).crCalculado;
  const novoCR = calcularCRAcumulado(state.historyData || {}, state.simulatorDisciplinas);
  const impacto = calcularImpactoCR(baseResumo.crCalculado, novoCR.crCalculado);

  simulatorResultEls.crPeriodo.textContent = formatNumberBR(crPeriodo, 3);
  simulatorResultEls.novoCR.textContent = formatNumberBR(novoCR.crCalculado, 3);
  simulatorResultEls.impacto.textContent = `${impacto.absoluto >= 0 ? '+' : ''}${formatNumberBR(
    impacto.absoluto,
    3
  )} (${formatNumberBR(impacto.percentual, 2)}%)`;

  updateMetaReversaResult();
}

async function importBOAForSimulator(container) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,application/pdf';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) {
      cleanupInput(input);
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { obrigatorias, optativas } = await processarBOA(arrayBuffer);
      const todas = [...obrigatorias, ...optativas];
      const statusPendentes = ['pendente', 'cursando', 'inscricao_facultada', 'inscricao_vedada', 'a_cursar'];
      const pendentes = todas.filter(
        (d) => statusPendentes.includes(d.status) && d.periodoRecomendado != null
      );

      console.log('Disciplinas BOA parseadas:', pendentes);

      if (pendentes.length === 0) {
        alert('Nenhuma disciplina pendente encontrada no BOA.');
        cleanupInput(input);
        return;
      }

      pendentes.forEach((d) => {
        state.simulatorDisciplinas.push({
          codigo: d.codigo,
          nome: d.nome,
          crR: d.crR,
          grau: 0,
          pontos: 0,
          situacao: 'Cursando',
          conferGrau: true,
        });
      });

      renderSimulatorTable();
      updateSimulatorResults();
    } catch (err) {
      console.error('Erro ao importar pendências do BOA:', err);
      alert('Erro ao processar BOA: ' + err.message);
    } finally {
      cleanupInput(input);
    }
  });

  input.click();
}

function cleanupInput(input) {
  try {
    document.body.removeChild(input);
  } catch {}
}

let metaReversaState = null;

function renderMetaReversa() {
  metaReversaState = {
    crAlvoInput: el('input', { type: 'text', value: '7,0' }),
    crRRestantesInput: el('input', { type: 'text', value: '0' }),
  };
  metaReversaResultEl = el('p', { className: 'text-muted' }, 'Preencha os campos para calcular a média necessária.');

  const calcular = () => updateMetaReversaResult();
  metaReversaState.crAlvoInput.addEventListener('input', calcular);
  metaReversaState.crRRestantesInput.addEventListener('input', calcular);

  return el('div', { className: 'card' }, [
    el('h4', {}, 'Meta Reversa'),
    el('p', { className: 'text-muted' }, 'Descubra a média necessária nas disciplinas restantes para atingir um CR alvo.'),
    el('div', { className: 'form-row' }, [
      el('label', {}, ['CR alvo: ', metaReversaState.crAlvoInput]),
      el('label', {}, ['Créditos restantes: ', metaReversaState.crRRestantesInput]),
    ]),
    metaReversaResultEl,
  ]);
}

function updateMetaReversaResult() {
  if (!metaReversaResultEl || !metaReversaState) return;

  const crAlvo = parseNumberBR(metaReversaState.crAlvoInput.value);
  const crRRestantes = parseNumberBR(metaReversaState.crRRestantesInput.value);
  if (Number.isNaN(crAlvo)) return;

  const media = calcularMetaReversa(crAlvo, state.historyData, state.simulatorDisciplinas, [
    { crR: crRRestantes },
  ]);

  if (media === null) {
    metaReversaResultEl.textContent = 'Adicione créditos restantes para calcular a meta.';
    return;
  }

  if (media < 0) {
    metaReversaResultEl.textContent = `Nota necessária: ${formatNumberBR(media, 3)} (já está acima do CR alvo com as notas atuais).`;
  } else if (media > 10) {
    metaReversaResultEl.textContent = `Nota necessária: ${formatNumberBR(media, 3)} (impossível atingir com apenas nota 10).`;
  } else {
    metaReversaResultEl.textContent = `Nota necessária nas disciplinas restantes: ${formatNumberBR(media, 3)}`;
  }
}

/* ============================================================
   Cálculo Rápido
   ============================================================ */

function initQuickCalculator() {
  const container = document.getElementById('quick-calculator-content');
  if (!container) return;

  const crAtualInput = el('input', { type: 'text', value: '' });
  const crRAtualInput = el('input', { type: 'text', value: '' });
  const pontosAtuaisInput = el('input', { type: 'text', value: '' });
  const useCRRadio = el('input', { type: 'radio', name: 'base-mode', value: 'cr', checked: true });
  const usePontosRadio = el('input', { type: 'radio', name: 'base-mode', value: 'pontos' });

  const disciplinas = [];
  const tableContainer = el('div', {}, []);

  const renderResult = () => {
    clearElement(tableContainer);

    let crRBase = 0;
    let pontosBase = 0;

    if (usePontosRadio.checked) {
      crRBase = parseNumberBR(crRAtualInput.value);
      pontosBase = parseNumberBR(pontosAtuaisInput.value);
    } else {
      const cr = parseNumberBR(crAtualInput.value);
      const crR = parseNumberBR(crRAtualInput.value);
      crRBase = crR;
      pontosBase = cr * crR;
    }

    const extras = calcularCRDisciplinas(disciplinas);
    const crRTotal = crRBase + extras.crRComGrau;
    const pontosTotal = pontosBase + extras.pontosTotais;
    const crNovo = crRTotal ? pontosTotal / crRTotal : 0;
    const crPeriodo = extras.crCalculado;
    const impacto = calcularImpactoCR(crRBase ? pontosBase / crRBase : 0, crNovo);

    tableContainer.appendChild(
      el('div', { className: 'cards-grid' }, [
        el('div', { className: 'card' }, [
          el('h4', {}, 'CR Atual'),
          el('p', {}, crRBase ? formatNumberBR(pontosBase / crRBase, 3) : '-'),
        ]),
        el('div', { className: 'card' }, [
          el('h4', {}, 'CR do Período'),
          el('p', {}, formatNumberBR(crPeriodo, 3)),
        ]),
        el('div', { className: 'card' }, [
          el('h4', {}, 'Novo CR'),
          el('p', {}, formatNumberBR(crNovo, 3)),
        ]),
        el('div', { className: 'card' }, [
          el('h4', {}, 'Impacto'),
          el(
            'p',
            {},
            `${impacto.absoluto >= 0 ? '+' : ''}${formatNumberBR(impacto.absoluto, 3)} (${formatNumberBR(
              impacto.percentual,
              2
            )}%)`
          ),
        ]),
      ])
    );
  };

  const updateDisciplinas = (updated) => {
    disciplinas.length = 0;
    disciplinas.push(...updated);
    renderResult();
  };

  const addDisciplina = () => {
    disciplinas.push({ codigo: '', nome: '', crR: 0, grau: 0, pontos: 0, situacao: 'Cursando', conferGrau: true });
    renderTable();
  };

  const renderTable = () => {
    clearElement(tableContainer);
    tableContainer.appendChild(renderQuickTable(disciplinas));
    renderResult();
  };

  function renderQuickTable(items) {
    const table = el('table', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', {}, 'Código'),
          el('th', {}, 'Disciplina'),
          el('th', {}, 'CrR'),
          el('th', {}, 'Nota'),
          el('th', {}, ''),
        ]),
      ]),
    ]);
    const tbody = el('tbody', {});

    if (items.length === 0) {
      tbody.appendChild(el('tr', {}, [el('td', { colspan: 5, className: 'text-muted' }, 'Nenhuma disciplina adicionada.')]));
    } else {
      items.forEach((disciplina, index) => {
        tbody.appendChild(
          el('tr', {}, [
            el('td', {}, [
              el('input', {
                type: 'text',
                value: disciplina.codigo || '',
                placeholder: 'Código',
                oninput: (e) => updateDisciplinaField(index, 'codigo', e.target.value),
              }),
            ]),
            el('td', {}, [
              el('input', {
                type: 'text',
                value: disciplina.nome || '',
                placeholder: 'Nome da disciplina',
                oninput: (e) => updateDisciplinaField(index, 'nome', e.target.value),
              }),
            ]),
            el('td', {}, [
              el('input', {
                type: 'text',
                value: disciplina.crR || '',
                placeholder: 'CrR',
                oninput: (e) => updateDisciplinaField(index, 'crR', e.target.value),
              }),
            ]),
            el('td', {}, [
              el('input', {
                type: 'text',
                value: disciplina.grau || '',
                placeholder: 'Nota',
                oninput: (e) => updateDisciplinaField(index, 'grau', e.target.value),
              }),
            ]),
            el('td', {}, [
              el(
                'button',
                {
                  type: 'button',
                  className: 'btn btn-icon btn-danger',
                  title: 'Remover',
                  onclick: () => removeDisciplina(index),
                },
                [el('i', { className: 'bi bi-trash' })]
              ),
            ]),
          ])
        );
      });
    }

    table.appendChild(tbody);
    return table;
  }

  const removeDisciplina = (index) => {
    disciplinas.splice(index, 1);
    renderTable();
  };

  const modeChange = () => {
    crAtualInput.disabled = usePontosRadio.checked;
    pontosAtuaisInput.disabled = !usePontosRadio.checked;
    renderResult();
  };

  useCRRadio.addEventListener('change', modeChange);
  usePontosRadio.addEventListener('change', modeChange);
  crAtualInput.addEventListener('input', renderResult);
  crRAtualInput.addEventListener('input', renderResult);
  pontosAtuaisInput.addEventListener('input', renderResult);

  const baseForm = el('div', { className: 'card' }, [
    el('h4', {}, 'Base Atual'),
    el('div', { className: 'form-row' }, [
      el('label', {}, [useCRRadio, ' CR atual + Créditos']),
      el('label', {}, [usePontosRadio, ' Pontos + Créditos']),
    ]),
    el('div', { className: 'form-row' }, [
      el('label', {}, ['CR atual: ', crAtualInput]),
      el('label', {}, ['Créditos: ', crRAtualInput]),
      el('label', {}, ['Pontos: ', pontosAtuaisInput]),
    ]),
  ]);

  const actions = el('div', { className: 'actions-row' }, [
    el('button', { className: 'btn btn-primary', type: 'button', onclick: addDisciplina }, [
      el('i', { className: 'bi bi-plus-lg' }),
      ' Adicionar disciplina',
    ]),
  ]);

  modeChange();
  container.appendChild(baseForm);
  container.appendChild(actions);
  container.appendChild(tableContainer);
  renderTable();
}

init();
