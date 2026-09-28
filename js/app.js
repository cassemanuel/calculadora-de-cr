import {
  loadThemePreference,
  saveThemePreference,
  loadHistory,
  saveHistory,
  clearHistory,
  clearPlanner,
  savePlanner,
  exportJSON,
  importJSON,
} from './storage.js';
import { processarPDF } from './pdfParser.js';
import { calcularMetricasPorEixo, verificarElegibilidadeEstagio } from './eixos.js';
import { initPlanner, refreshPlanner, getPlannerData } from './planner.js';
import {
  calcularCRAcumulado,
  disciplinaConferGrau,
} from './calculator.js';
import {
  el,
  badgeClassForSituacao,
  clearElement,
  formatNumberBR,
  validatePdfFile,
} from './ui.js';

// Estado global da aplicação.
const state = {
  historyData: null,
};

function init() {
  configurePdfWorker();
  initTheme();
  initTabs();
  initDropzone();
  initDataActions();
  initPlanner(() => state.historyData);
  initChartResize();

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
    if (toggleBtn) {
      toggleBtn.setAttribute('title', 'Mudar para tema claro');
      toggleBtn.setAttribute('aria-label', 'Mudar para tema claro');
      toggleBtn.setAttribute('aria-pressed', 'true');
    }
  } else {
    html.removeAttribute('data-theme');
    if (icon) {
      icon.classList.remove('bi-moon-stars-fill');
      icon.classList.add('bi-sun-fill');
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('title', 'Mudar para tema escuro');
      toggleBtn.setAttribute('aria-label', 'Mudar para tema escuro');
      toggleBtn.setAttribute('aria-pressed', 'false');
    }
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

      if (targetTab === 'analytics') {
        renderAnalytics();
      }
      if (targetTab === 'planner') {
        refreshPlanner();
      }
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

  try {
    validatePdfFile(file);

    // Evita que um cache antigo ou corrompido influencie o novo processamento.
    clearHistory();
    state.historyData = null;

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
    exportJSON({ ...state.historyData, planner: getPlannerData() });
  });

  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const data = await importJSON(file);
      const { planner, ...historico } = data;
      if (planner) {
        savePlanner(planner);
        refreshPlanner();
      }
      historico.resumo = calcularCRAcumulado(historico);
      state.historyData = historico;
      saveHistory(historico);
      renderReport(report, historico);
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
      clearPlanner();
      state.historyData = null;
      clearElement(report);
      report?.classList.add('hidden');
      refreshPlanner();
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

  if (metadata?.tipoDocumento === 'historico') {
    container.appendChild(
      el('div', { className: 'card card-aviso' }, [
        el('span', { className: 'badge badge-reprovado' }, 'Atenção'),
        el('p', { className: 'card-aviso-texto' },
          'O Histórico Escolar da UFRJ omite reprovações. Se você possui reprovações anteriores ' +
          '(RM/RF/RFM), o CR calculado aqui será diferente do oficial. Para obter o CR exato com ' +
          'reprovações computadas, envie o Boletim Não Oficial.'
        ),
      ])
    );
  }

  const headerCards = el('div', { className: 'cards-grid' }, [
    renderMetadataCard(metadata),
    renderResumoCard(resumo, metadata),
  ]);
  container.appendChild(headerCards);

  if (periodos?.length) {
    const btnExpandir = el(
      'button',
      { className: 'btn btn-secondary', type: 'button' },
      'Expandir Tudo'
    );
    const periodosSection = el('section', { className: 'periodos-list' }, [
      el('div', { className: 'periodos-header' }, [
        el('h3', {}, 'Disciplinas por Período'),
        btnExpandir,
      ]),
    ]);

    btnExpandir.addEventListener('click', () => {
      const bodies = periodosSection.querySelectorAll('.periodo-body');
      const todosAbertos = [...bodies].every((b) => !b.classList.contains('hidden'));
      bodies.forEach((b) => {
        b.classList.toggle('hidden', todosAbertos);
        const header = b.previousElementSibling;
        if (header?.getAttribute('aria-expanded') !== null) {
          header?.setAttribute('aria-expanded', String(!todosAbertos));
        }
      });
      btnExpandir.textContent = todosAbertos ? 'Expandir Tudo' : 'Recolher Tudo';
    });

    periodos.forEach((periodo, index) => {
      const periodosAteAqui = periodos.slice(0, index + 1);
      const crAcumulado = calcularCRAcumulado({ periodos: periodosAteAqui });
      periodosSection.appendChild(renderPeriodo(periodo, crAcumulado));
    });

    container.appendChild(periodosSection);
  }

  renderAnalytics();
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

function renderResumoCard(resumo, metadata) {
  const avisoHistorico = metadata?.tipoDocumento === 'historico'
    ? el('div', { className: 'cr-label' }, [
        el('span', { className: 'badge badge-reprovado' }, 'histórico: sem reprovações'),
      ])
    : null;

  return el('div', { className: 'card cr-dashboard' }, [
    el('h3', {}, 'Resumo do CR'),
    el('div', { className: 'cr-value' }, formatNumberBR(resumo.crCalculado, 3)),
    el('div', { className: 'cr-label' }, 'CR calculado'),
    avisoHistorico,
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
    el('caption', {}, `Disciplinas cursadas no período ${periodo.periodo || 'não identificado'}`),
    el('thead', {}, [
      el('tr', {}, [
        el('th', { scope: 'col' }, 'Código'),
        el('th', { scope: 'col' }, 'Disciplina'),
        el('th', { scope: 'col' }, 'CH'),
        el('th', { scope: 'col' }, 'CrR'),
        el('th', { scope: 'col' }, 'Grau'),
        el('th', { scope: 'col' }, 'Pontos'),
        el('th', { scope: 'col' }, 'SF'),
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

  header.setAttribute('aria-expanded', 'false');
  header.addEventListener('click', () => {
    const aberto = !body.classList.toggle('hidden');
    header.setAttribute('aria-expanded', String(aberto));
  });

  return el('div', { className: 'card periodo-card' }, [header, body]);
}

/* ============================================================
   Análise e Evolução
   ============================================================ */

function periodoKey(periodo) {
  const match = String(periodo || '').match(/(\d{4})\s*(?:\/\s*(\d))?/);
  if (!match) return Infinity;
  return parseInt(match[1], 10) * 10 + (parseInt(match[2], 10) || 0);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Calcula os pontos das duas séries do gráfico de evolução (CR do período e
 * CR acumulado), ignorando registros sem disciplinas que conferem grau
 * (ex.: bloco de créditos transferidos "2023"), que derrubariam a linha.
 * @param {Array<object>} periodosOrdenados Períodos já ordenados cronologicamente.
 * @returns {Array<object>}
 */
function calcularPontosGrafico(periodosOrdenados) {
  return periodosOrdenados
    .map((periodo, index) => ({
      periodo: periodo.periodo || `${index + 1}`,
      crPeriodo: calcularCRAcumulado({ periodos: [periodo] }).crCalculado,
      crAcumulado: calcularCRAcumulado({
        periodos: periodosOrdenados.slice(0, index + 1),
      }).crCalculado,
      crRComGrau: calcularCRAcumulado({ periodos: [periodo] }).crRComGrau,
      disciplinas: periodo.disciplinas || [],
    }))
    .filter((p) => p.crRComGrau > 0);
}

/**
 * Re-renderiza o card do gráfico no resize da janela, com throttle via
 * requestAnimationFrame para não sobrecarregar o navegador. Substitui apenas
 * o card do gráfico, preservando o estado dos accordions de eixos.
 */
function initChartResize() {
  let rafId = null;
  window.addEventListener('resize', () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const container = document.getElementById('analytics-content');
      const panel = document.getElementById('tab-analytics');
      if (!container || !panel?.classList.contains('active')) return;

      const periodos = state.historyData?.periodos;
      const primeiroCard = container.firstElementChild;
      if (!periodos?.length || !primeiroCard) return;

      const ordenados = [...periodos].sort(
        (a, b) => periodoKey(a.periodo) - periodoKey(b.periodo)
      );
      container.replaceChild(renderChartCard(calcularPontosGrafico(ordenados)), primeiroCard);
    });
  });
}

function svgEl(tag, attrs = {}, children) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child instanceof Node) node.appendChild(child);
    else if (child !== null && child !== undefined) node.appendChild(document.createTextNode(String(child)));
  });
  return node;
}

function renderAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;
  clearElement(container);

  const data = state.historyData;
  if (!data?.periodos?.length) {
    container.appendChild(
      el('div', { className: 'card' }, [
        el('p', { className: 'text-muted' },
          'Importe seu boletim na aba "Histórico via PDF" para visualizar a análise histórica.'),
      ])
    );
    return;
  }

  const periodos = [...data.periodos].sort((a, b) => periodoKey(a.periodo) - periodoKey(b.periodo));
  const pontos = calcularPontosGrafico(periodos);

  container.appendChild(renderChartCard(pontos));
  container.appendChild(renderEstagioCard(data));
  container.appendChild(renderMetricasHistoricas(periodos, data.resumo, pontos));
  container.appendChild(renderEixosCard(data));
}

function renderChartCard(pontos) {
  const largura = 720;
  const altura = 320;
  const margem = { topo: 20, direita: 20, base: 90, esquerda: 45 };
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.base;

  const valores = pontos.flatMap((p) => [p.crPeriodo, p.crAcumulado]).filter((v) => v > 0);
  let yMin = valores.length ? Math.max(0, Math.floor(Math.min(...valores) - 0.5)) : 0;
  let yMax = valores.length ? Math.min(10, Math.ceil(Math.max(...valores) + 0.5)) : 10;
  if (yMax - yMin < 1) yMax = yMin + 1;

  const x = (i) => margem.esquerda + (pontos.length > 1 ? (i / (pontos.length - 1)) * w : w / 2);
  const y = (v) => margem.topo + h - ((v - yMin) / (yMax - yMin)) * h;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${largura} ${altura}`,
    class: 'chart-svg',
    role: 'img',
    'aria-label': 'Gráfico de evolução do CR',
  });

  // Grade horizontal e rótulos do eixo Y.
  for (let tick = Math.ceil(yMin); tick <= Math.floor(yMax); tick++) {
    svg.appendChild(svgEl('line', {
      x1: margem.esquerda, x2: largura - margem.direita,
      y1: y(tick), y2: y(tick),
      class: 'chart-grid-line',
    }));
    svg.appendChild(svgEl('text', {
      x: margem.esquerda - 8, y: y(tick) + 4,
      'text-anchor': 'end', class: 'chart-label',
    }, tick));
  }

  // Rótulos do eixo X (rotacionados para não encavalarem; o texto cresce
  // para baixo-esquerda a partir da âncora, então a baseline sobe o
  // suficiente para não cortar na borda inferior do viewBox).
  pontos.forEach((p, i) => {
    svg.appendChild(svgEl('text', {
      x: x(i), y: altura - 26,
      'text-anchor': 'end',
      transform: `rotate(-35 ${x(i)} ${altura - 26})`,
      class: 'chart-label chart-label-x',
    }, p.periodo));
  });

  const toPoints = (key) =>
    pontos.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  // Linha do CR do período (tracejada). Os atributos de traço ficam explícitos
  // para que a linha continue visível mesmo se o CSS do gráfico não aplicar.
  svg.appendChild(svgEl('polyline', {
    points: toPoints('crPeriodo'),
    fill: 'none',
    stroke: '#f59e0b',
    'stroke-width': '2',
    'stroke-dasharray': '4,4',
    class: 'chart-line chart-line-periodo',
  }));
  // Linha do CR acumulado (contínua).
  svg.appendChild(svgEl('polyline', {
    points: toPoints('crAcumulado'),
    fill: 'none',
    stroke: 'var(--chart-acum)',
    'stroke-width': '3',
    class: 'chart-line chart-line-acumulado',
  }));

  // Tooltip singleton: um único nó é reaproveitado em todos os hovers,
  // evitando recriar elementos do DOM a cada evento de mouse.
  const tooltip = el('div', { className: 'chart-tooltip', role: 'tooltip' });
  tooltip.style.display = 'none';

  const wrap = el('div', { className: 'chart-wrap' }, [svg, tooltip]);

  const hideTooltip = () => {
    tooltip.style.display = 'none';
  };

  const positionTooltip = (clientX, clientY) => {
    const rect = wrap.getBoundingClientRect();
    let tx = clientX - rect.left + 14;
    let ty = clientY - rect.top + 14;
    if (tx + tooltip.offsetWidth > rect.width - 8) tx = clientX - rect.left - tooltip.offsetWidth - 14;
    if (ty + tooltip.offsetHeight > rect.height - 8) ty = clientY - rect.top - tooltip.offsetHeight - 14;
    tooltip.style.left = `${Math.max(8, tx)}px`;
    tooltip.style.top = `${Math.max(8, ty)}px`;
  };

  const showTooltip = (index, clientX, clientY) => {
    clearElement(tooltip);
    tooltip.appendChild(buildChartTooltip(pontos, index));
    tooltip.style.display = 'block';
    positionTooltip(clientX, clientY);
  };

  // Pontos interativos com tooltip rico.
  pontos.forEach((p, i) => {
    [
      { cy: y(p.crAcumulado), cls: 'chart-dot-acumulado', cor: 'var(--chart-acum)', rotulo: 'CR acumulado' },
      { cy: y(p.crPeriodo), cls: 'chart-dot-periodo', cor: 'var(--chart-periodo)', rotulo: 'CR do período' },
    ].forEach(({ cy, cls, cor, rotulo }) => {
      const dot = svgEl('circle', {
        cx: x(i), cy, r: 5,
        class: `chart-dot ${cls}`,
        fill: 'var(--bg-card)',
        stroke: cor,
        'stroke-width': '2',
        tabindex: '0',
        'aria-label': `${p.periodo} — ${rotulo}`,
      });
      dot.addEventListener('mouseenter', (e) => showTooltip(i, e.clientX, e.clientY));
      dot.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
      dot.addEventListener('mouseleave', hideTooltip);
      dot.addEventListener('focus', () => {
        const r = dot.getBoundingClientRect();
        showTooltip(i, r.left + r.width / 2, r.top + r.height / 2);
      });
      dot.addEventListener('blur', hideTooltip);
      svg.appendChild(dot);
    });
  });

  const legenda = el('div', { className: 'chart-legenda' }, [
    el('span', { className: 'chart-legenda-item' }, [
      el('span', { className: 'chart-swatch chart-swatch-acumulado' }),
      ' CR Acumulado',
    ]),
    el('span', { className: 'chart-legenda-item' }, [
      el('span', { className: 'chart-swatch chart-swatch-periodo' }),
      ' CR do Período',
    ]),
  ]);

  return el('div', { className: 'card' }, [
    el('h3', {}, 'Evolução do CR'),
    wrap,
    legenda,
  ]);
}

function buildChartTooltip(pontos, index) {
  const p = pontos[index];
  const delta = index > 0 ? p.crAcumulado - pontos[index - 1].crAcumulado : null;

  const stats = el('div', { className: 'chart-tooltip-stats' }, [
    el('span', {}, ['CR período: ', el('strong', {}, formatNumberBR(p.crPeriodo, 2))]),
    el('span', {}, ['CR acumulado: ', el('strong', {}, formatNumberBR(p.crAcumulado, 2))]),
  ]);
  if (delta !== null) {
    stats.appendChild(
      el(
        'span',
        { className: `chart-tooltip-delta ${delta >= 0 ? 'delta-up' : 'delta-down'}` },
        `Variação do CR: ${delta >= 0 ? '+' : ''}${formatNumberBR(delta, 2)}`
      )
    );
  }

  const children = [
    el('div', { className: 'chart-tooltip-title' }, p.periodo),
    stats,
  ];

  if (p.disciplinas?.length) {
    children.push(
      el('ul', { className: 'chart-tooltip-disciplinas' },
        p.disciplinas.map((d) =>
          el('li', {}, [
            el('span', { className: 'chart-tooltip-cod' }, d.codigo || '—'),
            ` ${d.nome || 'Disciplina'} — `,
            el('strong', {}, d.grau != null ? formatNumberBR(d.grau, 1) : '—'),
          ])
        )
      )
    );
  }

  return el('div', {}, children);
}

/**
 * Card de diagnóstico de elegibilidade para estágio não obrigatório,
 * conforme o Art. 4º do Anexo C do PPC 2022 (ciclo básico, CR mínimo e
 * tempo máximo de integralização).
 * @param {object} data Dados do histórico.
 * @returns {HTMLElement}
 */
function renderEstagioCard(data) {
  const { apto, criterios } = verificarElegibilidadeEstagio(data);

  return el('div', { className: `card estagio-card ${apto ? 'estagio-apto' : 'estagio-pendente'}` }, [
    el('div', { className: 'estagio-header' }, [
      el('h4', {}, 'Elegibilidade para Estágio'),
      el('span', { className: `badge ${apto ? 'badge-ap' : 'badge-cursando'}` },
        apto ? 'Apto para Estágio Não Obrigatório' : 'Pendente para Estágio'),
    ]),
    el('ul', { className: 'estagio-criterios' },
      criterios.map((c) =>
        el('li', { className: c.ok ? 'criterio-ok' : 'criterio-falta' }, [
          el('i', {
            className: `bi ${c.ok ? 'bi-check-circle-fill' : 'bi-exclamation-circle'}`,
            'aria-hidden': 'true',
          }),
          el('span', {}, ` ${c.rotulo} — ${c.detalhe}`),
        ])
      )
    ),
  ]);
}

function renderMetricasHistoricas(periodos, resumo, pontos) {
  const comGrau = pontos.filter((p) => p.crRComGrau > 0);
  const melhor = comGrau.reduce((a, b) => (b.crPeriodo > a.crPeriodo ? b : a), comGrau[0]);
  const pior = comGrau.reduce((a, b) => (b.crPeriodo < a.crPeriodo ? b : a), comGrau[0]);

  let creditosIntegralizados = 0;
  let aprovacoes = 0;
  let reprovacoes = 0;
  periodos.forEach((periodo) => {
    (periodo.disciplinas || []).forEach((d) => {
      const situacao = String(d.situacao || '').toUpperCase();
      if (situacao === 'CURSANDO') return;
      const crR = Number(d.crR);
      if (!isNaN(crR)) creditosIntegralizados += crR;
      if (disciplinaConferGrau(d)) {
        if (situacao === 'AP') aprovacoes += 1;
        else reprovacoes += 1;
      }
    });
  });

  const totalConcluidas = aprovacoes + reprovacoes;
  const taxaSucesso = totalConcluidas ? (aprovacoes / totalConcluidas) * 100 : 0;

  const cards = [
    ['Melhor CR de período', melhor ? `${formatNumberBR(melhor.crPeriodo, 3)} (${melhor.periodo})` : '-'],
    ['Pior CR de período', pior ? `${formatNumberBR(pior.crPeriodo, 3)} (${pior.periodo})` : '-'],
    ['Créditos integralizados', `${formatNumberBR(creditosIntegralizados, 0)} de ${formatNumberBR(resumo?.crRComGrau || 0, 0)} com grau`],
    ['Taxa de sucesso', `${formatNumberBR(taxaSucesso, 1)}% — ${aprovacoes} aprov. / ${reprovacoes} reprov.`],
  ];

  return el('div', { className: 'cards-grid' },
    cards.map(([label, valor]) =>
      el('div', { className: 'card metric-card' }, [
        el('span', { className: 'cr-detail-label' }, label),
        el('p', { className: 'metric-value' }, valor),
      ])
    )
  );
}

function renderEixosCard(data) {
  const eixos = calcularMetricasPorEixo(data);
  if (!eixos.length) return null;

  return el('div', {}, [
    el('h3', {}, 'Desempenho por Eixo Temático'),
    el('p', { className: 'text-muted' }, 'Clique em um eixo para ver as disciplinas cursadas.'),
    el('div', { className: 'cards-grid eixos-grid' },
      eixos.map((eixo) => renderEixoCard(eixo))
    ),
  ]);
}

function renderEixoCard(eixo) {
  const disciplinas = [...(eixo.disciplinas || [])]
    .sort((a, b) => periodoKey(a.periodo) - periodoKey(b.periodo));

  const body = el('div', { className: 'eixo-body hidden' }, [
    el('div', { className: 'table-container' }, [
      el('table', {}, [
        el('caption', {}, `Disciplinas cursadas no eixo ${eixo.eixo}`),
        el('thead', {}, [
          el('tr', {}, [
            el('th', { scope: 'col' }, 'Código'),
            el('th', { scope: 'col' }, 'Nome'),
            el('th', { scope: 'col' }, 'CrR'),
            el('th', { scope: 'col' }, 'Grau'),
            el('th', { scope: 'col' }, 'SF'),
          ]),
        ]),
        el('tbody', {},
          disciplinas.length
            ? disciplinas.map((d) =>
                el('tr', { className: d.conferGrau ? '' : 'row-muted' }, [
                  el('td', {}, d.codigo || '—'),
                  el('td', {}, d.nome || '—'),
                  el('td', {}, formatNumberBR(d.crR, 1)),
                  el('td', {}, d.grau != null ? formatNumberBR(d.grau, 1) : '—'),
                  el('td', {}, [
                    el('span', { className: `badge ${badgeClassForSituacao(d.situacao)}` },
                      d.situacao || '—'),
                  ]),
                ])
              )
            : [el('tr', {}, [
                el('td', { colspan: 5, className: 'text-muted' }, 'Nenhuma disciplina registrada.'),
              ])]
        ),
      ]),
    ]),
  ]);

  const header = el('button', {
    className: 'eixo-header',
    type: 'button',
    'aria-expanded': 'false',
  }, [
    el('div', { className: 'eixo-resumo' }, [
      el('h4', {}, eixo.eixo),
      el('p', { className: 'metric-value' }, formatNumberBR(eixo.cr, 3)),
      el('p', { className: 'text-muted' },
        `${eixo.total} disciplinas · ${formatNumberBR(eixo.creditosTotais, 0)} créditos`),
    ]),
    el('i', { className: 'bi bi-chevron-down eixo-chevron', 'aria-hidden': 'true' }),
  ]);

  header.addEventListener('click', () => {
    const aberto = !body.classList.toggle('hidden');
    header.classList.toggle('open', aberto);
    header.setAttribute('aria-expanded', String(aberto));
  });

  return el('div', { className: 'card metric-card eixo-card' }, [header, body]);
}

init();
