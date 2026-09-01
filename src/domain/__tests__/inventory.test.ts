import { describe, expect, it } from 'vitest';
import {
  adjustProductQuantity,
  adjustSupplyQuantity,
  canFulfillSale,
  isLowStock,
  purchaseSupply,
  receiveProduction,
  reverseProduction,
  reverseSale,
  reverseSupplyAdjustment,
  reverseSupplyPurchase,
  sell,
} from '../inventory';
import { makeMovement, makeProduct, makeSupply } from './factories';

describe('sell', () => {
  it('debita o estoque quando há quantidade suficiente', () => {
    const product = makeProduct({ quantity: 5 });
    const result = sell(product, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.quantity).toBe(3);
    }
  });

  it('falha e não altera nada quando a quantidade excede o estoque', () => {
    const product = makeProduct({ quantity: 2 });
    const result = sell(product, 5);
    expect(result).toEqual({
      ok: false,
      reason: 'insufficient_stock',
      available: 2,
      requested: 5,
    });
  });

  it('nunca deixa o estoque negativo', () => {
    const product = makeProduct({ quantity: 0 });
    expect(canFulfillSale(product, 1)).toBe(false);
  });

  it('rejeita quantidade não inteira ou não positiva', () => {
    const product = makeProduct({ quantity: 5 });
    expect(() => sell(product, 0)).toThrow();
    expect(() => sell(product, -1)).toThrow();
    expect(() => sell(product, 1.5)).toThrow();
  });
});

describe('receiveProduction', () => {
  it('soma unidades produzidas ao estoque', () => {
    const product = makeProduct({ quantity: 5 });
    expect(receiveProduction(product, 3).quantity).toBe(8);
  });

  it('rejeita quantidade inválida', () => {
    const product = makeProduct();
    expect(() => receiveProduction(product, 0)).toThrow();
    expect(() => receiveProduction(product, -2)).toThrow();
  });
});

describe('purchaseSupply', () => {
  it('soma a quantidade comprada, aceitando fração', () => {
    const supply = makeSupply({ quantity: 1.5 });
    expect(purchaseSupply(supply, 0.75).quantity).toBe(2.25);
  });
});

describe('ajustes manuais', () => {
  it('aceita delta positivo e negativo dentro do limite', () => {
    const product = makeProduct({ quantity: 5 });
    const up = adjustProductQuantity(product, 3);
    const down = adjustProductQuantity(product, -3);
    expect(up).toEqual({ ok: true, value: { ...product, quantity: 8 } });
    expect(down).toEqual({ ok: true, value: { ...product, quantity: 2 } });
  });

  it('rejeita ajuste que deixaria o produto negativo', () => {
    const product = makeProduct({ quantity: 2 });
    expect(adjustProductQuantity(product, -5)).toEqual({
      ok: false,
      reason: 'negative_result',
      resulting: -3,
    });
  });

  it('rejeita ajuste que deixaria o insumo negativo', () => {
    const supply = makeSupply({ quantity: 1 });
    expect(adjustSupplyQuantity(supply, -2)).toEqual({
      ok: false,
      reason: 'negative_result',
      resulting: -1,
    });
  });
});

describe('isLowStock', () => {
  it('marca quando a quantidade é igual ou menor que o mínimo', () => {
    expect(isLowStock({ quantity: 3, minQuantity: 3 })).toBe(true);
    expect(isLowStock({ quantity: 2, minQuantity: 3 })).toBe(true);
    expect(isLowStock({ quantity: 4, minQuantity: 3 })).toBe(false);
  });
});

describe('reversão de movimentos', () => {
  it('reverseSale devolve a quantidade vendida ao estoque', () => {
    const product = makeProduct({ quantity: 3 });
    const movement = makeMovement({ type: 'sale', quantity: 2 });
    expect(reverseSale(product, movement).quantity).toBe(5);
  });

  it('reverseSupplyPurchase retira a quantidade comprada', () => {
    const supply = makeSupply({ quantity: 5 });
    const movement = makeMovement({ type: 'supply_purchase', quantity: 2 });
    const result = reverseSupplyPurchase(supply, movement);
    expect(result).toEqual({ ok: true, value: { ...supply, quantity: 3 } });
  });

  it('reverseSupplyPurchase falha se já foi consumido além do que sobrou', () => {
    const supply = makeSupply({ quantity: 1 });
    const movement = makeMovement({ type: 'supply_purchase', quantity: 5 });
    expect(reverseSupplyPurchase(supply, movement)).toEqual({
      ok: false,
      reason: 'negative_result',
      resulting: -4,
    });
  });

  it('reverseSupplyAdjustment desfaz o delta original, seja positivo ou negativo', () => {
    const supply = makeSupply({ quantity: 10 });
    const positiveAdjustment = makeMovement({ type: 'adjustment', quantity: 4 });
    const negativeAdjustment = makeMovement({ type: 'adjustment', quantity: -4 });

    expect(reverseSupplyAdjustment(supply, positiveAdjustment)).toEqual({
      ok: true,
      value: { ...supply, quantity: 6 },
    });
    expect(reverseSupplyAdjustment(supply, negativeAdjustment)).toEqual({
      ok: true,
      value: { ...supply, quantity: 14 },
    });
  });

  it('reverseProduction devolve exatamente os insumos consumidos, mesmo que a receita atual seja diferente', () => {
    const wax = makeSupply({ id: 'wax', quantity: 2 });
    const wick = makeSupply({ id: 'wick', quantity: 8 });
    const product = makeProduct({ quantity: 10 });

    // O movimento registra o que foi consumido NA ÉPOCA da produção.
    const movement = makeMovement({
      type: 'production',
      quantity: 10,
      consumed: [
        { supplyId: 'wax', quantity: 1.8 },
        { supplyId: 'wick', quantity: 10 },
      ],
    });

    const result = reverseProduction(product, [wax, wick], movement);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.product.quantity).toBe(0);
      const updatedWax = result.value.supplies.find((s) => s.id === 'wax');
      const updatedWick = result.value.supplies.find((s) => s.id === 'wick');
      expect(updatedWax?.quantity).toBe(3.8);
      expect(updatedWick?.quantity).toBe(18);
    }
  });

  it('reverseProduction falha se o produto já foi vendido além do que a produção adicionou', () => {
    const product = makeProduct({ quantity: 2 });
    const movement = makeMovement({ type: 'production', quantity: 10, consumed: [] });
    expect(reverseProduction(product, [], movement)).toEqual({
      ok: false,
      reason: 'negative_result',
      resulting: -8,
    });
  });
});
