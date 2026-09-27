import { loadThemePreference, saveThemePreference, saveHistory } from './storage.js';
import { processarPDF } from './pdfParser.js';
import { calcularCRAcumulado } from './calculator.js';
import { el, badgeClassForSituacao, clearElement } from './ui.js';

/**
 * Inicializa a aplicação.
 */
function init() {
  configurePdfWorker();
  initTheme();
  initTabs();
  initDropzone();
}

/**
 * Configura o worker do pdfjs-dist a partir do CDN.
 */
function configurePdfWorker() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
  } else {
    console.warn('pdfjs-dist não carregado. O upload de PDF não funcionará.');
  }
}

/**
 * Inicializa o tema (light/dark) e o botão de toggle.
 */
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

/**
 * Aplica o tema ao elemento <html> e atualiza o ícone do botão.
 */
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

/**
 * Inicializa o comportamento das abas.
 */
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

/**
 * Configura o dropzone de upload de PDF.
 */
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

/**
 * Processa o arquivo PDF selecionado.
 */
async function handlePDFUpload(file, { progress, progressBar, report }) {
  progress?.classList.remove('hidden');
  progressBar && (progressBar.style.width = '0%');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = await processarPDF(arrayBuffer, (pct) => {
      if (progressBar) progressBar.style.width = `${Math.round(pct * 100)}%`;
    });

    const cr = calcularCRAcumulado(data);
    data.resumo = cr;

    saveHistory(data);
    renderReport(report, data);

    console.log('Histórico parseado:', data);
  } catch (err) {
    console.error(err);
    if (report) {
      clearElement(report);
      report.classList.remove('hidden');
      report.appendChild(
        el('div', { className: 'card' }, [
          el('h3', {}, 'Erro ao processar PDF'),
          el('p', { className: 'text-muted' }, err.message),
        ])
      );
    }
  } finally {
    progress?.classList.add('hidden');
  }
}

/**
 * Renderiza o relatório de metadados, resumo e períodos.
 */
function renderReport(container, data) {
  if (!container) return;
  clearElement(container);
  container.classList.remove('hidden');

  const { metadata, periodos, resumo } = data;

  // Cards de metadados e resumo
  const headerCards = el('div', { className: 'cards-grid' }, [
    renderMetadataCard(metadata),
    renderResumoCard(resumo),
  ]);
  container.appendChild(headerCards);

  // Tabela por período
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

  return el('div', { className: 'card' }, [
    el('h3', {}, 'Dados do Aluno'),
    ...items,
  ]);
}

function renderResumoCard(resumo) {
  return el('div', { className: 'card' }, [
    el('h3', {}, 'Resumo do CR'),
    el('p', {}, [
      el('strong', {}, 'Créditos com grau: '),
      resumo.crRComGrau?.toFixed(1) ?? '-',
    ]),
    el('p', {}, [
      el('strong', {}, 'Pontos totais: '),
      resumo.pontosTotais?.toFixed(1) ?? '-',
    ]),
    el('p', {}, [
      el('strong', {}, 'CR calculado: '),
      resumo.crCalculado?.toFixed(3) ?? '-',
    ]),
  ]);
}

function renderPeriodo(periodo) {
  const crPeriodo = calcularCRAcumulado({ periodos: [periodo] });
  const header = el('button', { className: 'periodo-header' }, [
    el('span', {}, periodo.periodo || 'Período não identificado'),
    el('span', {}, `CR: ${crPeriodo.crCalculado.toFixed(3)} — ${periodo.disciplinas.length} disciplinas`),
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
          el('td', {}, d.ch?.toString?.() ?? '-'),
          el('td', {}, d.crR?.toString?.() ?? '-'),
          el('td', {}, d.grau?.toString?.() ?? '-'),
          el('td', {}, d.pontos?.toString?.() ?? '-'),
          el('td', {}, [el('span', { className: `badge ${badgeClassForSituacao(d.situacao)}` }, d.situacao)]),
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

init();
