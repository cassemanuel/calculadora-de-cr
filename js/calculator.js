/**
 * Motor de cálculo de CR acumulado, do período e metas reversas.
 */

/**
 * Calcula CR simples a partir de pontos e créditos.
 * @param {number} pontos
 * @param {number} crR
 * @returns {number}
 */
export function calcularCR(pontos, crR) {
  if (!crR) return 0;
  return pontos / crR;
}

/**
 * Calcula o CR acumulado considerando disciplinas extras (simulação).
 * @param {Array<{pontos: number, crR: number}>} disciplinas
 * @returns {{crRComGrau: number, pontosTotais: number, crCalculado: number}}
 */
export function calcularCRAcumulado(disciplinas) {
  const crRComGrau = disciplinas.reduce((sum, d) => sum + (d.crR || 0), 0);
  const pontosTotais = disciplinas.reduce((sum, d) => sum + (d.pontos || 0), 0);
  const crCalculado = calcularCR(pontosTotais, crRComGrau);
  return { crRComGrau, pontosTotais, crCalculado };
}

/**
 * Calcula a média necessária em disciplinas restantes para atingir um CR alvo.
 * @param {number} crAlvo
 * @param {number} crRAtual
 * @param {number} pontosAtuais
 * @param {Array<{crR: number, pontos?: number}>} disciplinasAtuais
 * @param {number} crRRestantes
 * @returns {number|null}
 */
export function calcularMetaReversa(crAlvo, crRAtual, pontosAtuais, disciplinasAtuais, crRRestantes) {
  const crRTotalPrevisto = crRAtual + disciplinasAtuais.reduce((s, d) => s + (d.crR || 0), 0) + crRRestantes;
  const pontosJaPrevistos = disciplinasAtuais.reduce((s, d) => s + (d.pontos || 0), 0);
  const pontosNecessarios = crAlvo * crRTotalPrevisto - pontosAtuais - pontosJaPrevistos;
  if (crRRestantes <= 0) return null;
  return pontosNecessarios / crRRestantes;
}
