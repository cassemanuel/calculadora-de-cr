import { loadThemePreference, saveThemePreference } from './storage.js';

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
    // TODO: Etapa 3 – integrar com pdfParser.js
    console.log('Arquivo selecionado:', input.files?.[0]?.name);
  });
}

init();
