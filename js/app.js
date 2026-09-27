import {
  loadThemePreference,
  saveThemePreference,
  loadHistory,
  saveHistory,
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

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    handlePDFUpload(file, { progress, progressBar, report });
  });
}

async function handlePDFUpload(file, { progress, progressBar, report }) {
  progress?.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '0%';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = await processarPDF(arrayBuffer, (pct) => {
      if (progressBar) progressBar.style.width = `${Math.round(pct * 100)}%`;
    });

    data.resumo = calcularCRAcumulado(data);

    state.historyData = data;
    saveHistory(data);
    renderReport(report, data);

    console.log('Histórico parseado:', data);
  } catch (err) {
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

    periodos.forEach((periodo) => {
      periodosSection.appendChild(renderPeriodo(periodo));
    });

    container.appendChild(periodosSection);
  }
}

function renderMetadataCard(metadata) {
  const items = [
    ['Nome', metadata.nome],
    ['DRE', metadata.dre],
    ['Curso', metadata.curso],
    ['Ingresso', metadata.ingresso],
    ['Emissão', metadata.emissao],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => el('p', {}, [el('strong', {}, `${label}: `), value]));

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

function renderPeriodo(periodo) {
  const crPeriodo = calcularCRAcumulado({ periodos: [periodo] });
  const header = el('button', { className: 'periodo-header' }, [
    el('span', {}, periodo.periodo || 'Período não identificado'),
    el(
      'span',
      {},
      `CR: ${formatNumberBR(crPeriodo.crCalculado, 3)} — ${periodo.disciplinas.length} disciplinas`
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

function initSimulator() {
  const container = document.getElementById('pdf-simulator-content');
  if (!container) return;

  renderSimulator(container);
}

function renderSimulator(container) {
  clearElement(container);

  const baseResumo = state.historyData?.resumo || { crRComGrau: 0, pontosTotais: 0, crCalculado: 0 };

  const table = renderDisciplinasTable(state.simulatorDisciplinas, (updated) => {
    state.simulatorDisciplinas = updated;
    renderSimulator(container);
  });

  const novoCR = calcularCRAcumulado(state.historyData || {}, state.simulatorDisciplinas);
  const impacto = calcularImpactoCR(baseResumo.crCalculado, novoCR.crCalculado);

  const resumo = el('div', { className: 'cards-grid' }, [
    el('div', { className: 'card' }, [
      el('h4', {}, 'CR do Período'),
      el('p', {}, formatNumberBR(calcularCRDisciplinas(state.simulatorDisciplinas).crCalculado, 3)),
    ]),
    el('div', { className: 'card' }, [
      el('h4', {}, 'Novo CR Acumulado'),
      el('p', {}, formatNumberBR(novoCR.crCalculado, 3)),
    ]),
    el('div', { className: 'card' }, [
      el('h4', {}, 'Impacto no CR'),
      el(
        'p',
        {},
        `${impacto.absoluto >= 0 ? '+' : ''}${formatNumberBR(impacto.absoluto, 3)} (${formatNumberBR(
          impacto.percentual,
          2
        )}%)`
      ),
    ]),
  ]);

  const metaSection = renderMetaReversa(baseResumo, state.simulatorDisciplinas);

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
      { className: 'btn btn-danger', type: 'button', onclick: () => { state.simulatorDisciplinas = []; renderSimulator(container); } },
      [el('i', { className: 'bi bi-trash' }), ' Limpar']
    ),
  ]);

  container.appendChild(actions);
  container.appendChild(table);
  container.appendChild(resumo);
  container.appendChild(metaSection);
}

function renderDisciplinasTable(disciplinas, onChange) {
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
    el(
      'tbody',
      {},
      disciplinas.length
        ? disciplinas.map((d, i) => renderDisciplinaRow(d, i, disciplinas, onChange))
        : [el('tr', {}, [el('td', { colspan: 5, className: 'text-muted' }, 'Nenhuma disciplina adicionada.')])]
    ),
  ]);

  return el('div', { className: 'table-container' }, [table]);
}

function renderDisciplinaRow(disciplina, index, disciplinas, onChange) {
  const updateField = (field, value) => {
    const updated = [...disciplinas];
    if (field === 'crR' || field === 'grau') {
      updated[index][field] = parseNumberBR(value);
      updated[index].pontos = updated[index].grau * updated[index].crR;
    } else {
      updated[index][field] = value;
    }
    updated[index].situacao = 'Cursando';
    updated[index].conferGrau = true;
    onChange(updated);
  };

  const removeRow = () => {
    const updated = disciplinas.filter((_, i) => i !== index);
    onChange(updated);
  };

  return el('tr', {}, [
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.codigo || '',
        placeholder: 'Código',
        oninput: (e) => updateField('codigo', e.target.value),
      }),
    ]),
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.nome || '',
        placeholder: 'Nome da disciplina',
        oninput: (e) => updateField('nome', e.target.value),
      }),
    ]),
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.crR || '',
        placeholder: 'CrR',
        oninput: (e) => updateField('crR', e.target.value),
      }),
    ]),
    el('td', {}, [
      el('input', {
        type: 'text',
        value: disciplina.grau || '',
        placeholder: 'Nota',
        oninput: (e) => updateField('grau', e.target.value),
      }),
    ]),
    el('td', {}, [
      el(
        'button',
        { className: 'btn btn-danger', type: 'button', onclick: removeRow },
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
  renderSimulator(container);
}

async function importBOAForSimulator(container) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,application/pdf';

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { obrigatorias } = await processarBOA(arrayBuffer);
      const pendentes = obrigatorias.filter((d) => d.status === 'pendente' || d.status === 'cursando');

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

      renderSimulator(container);
    } catch (err) {
      alert('Erro ao processar BOA: ' + err.message);
    }
  });

  input.click();
}

function renderMetaReversa(baseResumo, disciplinasPreenchidas) {
  const crAlvoInput = el('input', { type: 'text', value: '7,0' });
  const crRRestantesInput = el('input', { type: 'text', value: '0' });
  const resultEl = el('p', { className: 'text-muted' }, 'Preencha os campos para calcular a média necessária.');

  const calcular = () => {
    const crAlvo = parseNumberBR(crAlvoInput.value);
    const crRRestantes = parseNumberBR(crRRestantesInput.value);
    if (isNaN(crAlvo)) return;

    const media = calcularMetaReversa(crAlvo, state.historyData, disciplinasPreenchidas, [
      { crR: crRRestantes },
    ]);

    if (media === null) {
      resultEl.textContent = 'Adicione créditos restantes para calcular a meta.';
      return;
    }

    if (media < 0) {
      resultEl.textContent = `Nota necessária: ${formatNumberBR(media, 3)} (já está acima do CR alvo com as notas atuais).`;
    } else if (media > 10) {
      resultEl.textContent = `Nota necessária: ${formatNumberBR(media, 3)} (impossível atingir com apenas nota 10).`;
    } else {
      resultEl.textContent = `Nota necessária nas disciplinas restantes: ${formatNumberBR(media, 3)}`;
    }
  };

  crAlvoInput.addEventListener('input', calcular);
  crRRestantesInput.addEventListener('input', calcular);

  return el('div', { className: 'card' }, [
    el('h4', {}, 'Meta Reversa'),
    el('p', { className: 'text-muted' }, 'Descubra a média necessária nas disciplinas restantes para atingir um CR alvo.'),
    el('div', { className: 'form-row' }, [
      el('label', {}, ['CR alvo: ', crAlvoInput]),
      el('label', {}, ['Créditos restantes: ', crRRestantesInput]),
    ]),
    resultEl,
  ]);
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
    tableContainer.appendChild(
      renderDisciplinasTable(disciplinas, (updated) => {
        updateDisciplinas(updated);
        renderTable();
      })
    );
    renderResult();
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
