const STORAGE_KEYS = {
  history: 'cr-calculator-history',
  theme: 'cr-calculator-theme',
};

/**
 * Carrega a preferência de tema salva. Padrão: 'light'.
 * @returns {'light' | 'dark'}
 */
export function loadThemePreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage pode estar indisponível em modo privado ou restrito.
  }
  return 'light';
}

/**
 * Persiste a preferência de tema.
 * @param {'light' | 'dark'} theme
 */
export function saveThemePreference(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    // Ignora erros de localStorage.
  }
}

/**
 * Salva o histórico processado no localStorage.
 * @param {object} historyData
 */
export function saveHistory(historyData) {
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(historyData));
  } catch (e) {
    console.error('Erro ao salvar histórico:', e);
  }
}

/**
 * Carrega o histórico salvo, se existir e for válido.
 * @returns {object | null}
 */
export function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.history);
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (!data || !Array.isArray(data.periodos) || data.periodos.length === 0) {
      console.warn('Histórico salvo inválido ou vazio; ignorando cache.');
      return null;
    }

    if (!data.resumo || !data.resumo.crRComGrau) {
      console.warn('Resumo do histórico salvo zerado; ignorando cache.');
      return null;
    }

    return data;
  } catch (e) {
    console.error('Erro ao carregar histórico:', e);
    return null;
  }
}

/**
 * Exporta o histórico como arquivo JSON para download.
 * @param {object} historyData
 */
export function exportJSON(historyData) {
  const blob = new Blob([JSON.stringify(historyData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico-cr-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Lê um arquivo JSON e retorna o conteúdo parseado.
 * @param {File} file
 * @returns {Promise<object>}
 */
export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(new Error('Arquivo JSON inválido.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(file);
  });
}
