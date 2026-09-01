/**
 * Insumos podem ter quantidade fracionária (0.18 kg por vela). Operações de
 * ponto flutuante acumulam erro (0.18 × 10 === 1.7999999999999998), então
 * toda aritmética de quantidade passa por aqui antes de virar resultado ou
 * ser comparada. Seis casas decimais é precisão de sobra para gramas.
 */
export function roundQuantity(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
