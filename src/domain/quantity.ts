/**
 * Insumos podem ter quantidade fracionária (0.18 kg por vela). Operações de
 * ponto flutuante acumulam erro (0.18 × 10 === 1.7999999999999998), então
 * toda aritmética de quantidade passa por aqui antes de virar resultado ou
 * ser comparada. Seis casas decimais é precisão de sobra para gramas.
 */
export function roundQuantity(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/**
 * Formata uma quantidade para exibição, ex.: 11840 -> '11.840', 9.5 -> '9,5'.
 * Arredonda antes para não exibir resíduo de ponto flutuante.
 */
export function formatQuantity(value: number): string {
  return quantityFormatter.format(roundQuantity(value));
}
