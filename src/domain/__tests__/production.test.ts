import { describe, expect, it } from 'vitest';
import { produce } from '../production';
import { makeProduct, makeRecipe, makeSupply } from './factories';

describe('produce', () => {
  it('produz sem tocar insumos quando o produto não tem ficha técnica', () => {
    const product = makeProduct({ quantity: 5, recipeId: undefined });
    const result = produce(product, 3, undefined, []);
    expect(result).toEqual({
      ok: true,
      value: { product: { ...product, quantity: 8 }, supplies: [], consumed: [] },
    });
  });

  it('calcula o consumo pela ficha técnica e baixa os insumos', () => {
    const wax = makeSupply({ id: 'wax', quantity: 5 });
    const wick = makeSupply({ id: 'wick', quantity: 20 });
    const recipe = makeRecipe({
      items: [
        { supplyId: 'wax', quantityPerUnit: 0.18 },
        { supplyId: 'wick', quantityPerUnit: 1 },
      ],
    });
    const product = makeProduct({ quantity: 0, recipeId: recipe.id });

    const result = produce(product, 10, recipe, [wax, wick]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.product.quantity).toBe(10);
      expect(result.value.consumed).toEqual([
        { supplyId: 'wax', quantity: 1.8 },
        { supplyId: 'wick', quantity: 10 },
      ]);
      expect(result.value.supplies.find((s) => s.id === 'wax')?.quantity).toBeCloseTo(3.2);
      expect(result.value.supplies.find((s) => s.id === 'wick')?.quantity).toBe(10);
    }
  });

  it('falha sem aplicar nenhum efeito quando falta insumo', () => {
    const wax = makeSupply({ id: 'wax', quantity: 1 });
    const wick = makeSupply({ id: 'wick', quantity: 20 });
    const recipe = makeRecipe({
      items: [
        { supplyId: 'wax', quantityPerUnit: 0.18 },
        { supplyId: 'wick', quantityPerUnit: 1 },
      ],
    });
    const product = makeProduct({ quantity: 0, recipeId: recipe.id });

    const result = produce(product, 10, recipe, [wax, wick]);

    expect(result).toEqual({
      ok: false,
      reason: 'missing_supplies',
      missing: [{ supplyId: 'wax', required: 1.8, available: 1 }],
    });
    // nada mudou nos objetos originais — a função é pura
    expect(wax.quantity).toBe(1);
    expect(product.quantity).toBe(0);
  });

  it('reporta todos os insumos que faltam, não só o primeiro', () => {
    const wax = makeSupply({ id: 'wax', quantity: 0 });
    const wick = makeSupply({ id: 'wick', quantity: 0 });
    const recipe = makeRecipe({
      items: [
        { supplyId: 'wax', quantityPerUnit: 0.18 },
        { supplyId: 'wick', quantityPerUnit: 1 },
      ],
    });
    const product = makeProduct({ quantity: 0, recipeId: recipe.id });

    const result = produce(product, 5, recipe, [wax, wick]);

    expect(result).toEqual({
      ok: false,
      reason: 'missing_supplies',
      missing: [
        { supplyId: 'wax', required: 0.9, available: 0 },
        { supplyId: 'wick', required: 5, available: 0 },
      ],
    });
  });

  it('trata insumo ausente da lista como disponibilidade zero', () => {
    const recipe = makeRecipe({ items: [{ supplyId: 'missing-supply', quantityPerUnit: 1 }] });
    const product = makeProduct({ quantity: 0, recipeId: recipe.id });

    const result = produce(product, 1, recipe, []);

    expect(result).toEqual({
      ok: false,
      reason: 'missing_supplies',
      missing: [{ supplyId: 'missing-supply', required: 1, available: 0 }],
    });
  });

  it('rejeita quantidade não inteira ou não positiva', () => {
    const product = makeProduct();
    expect(() => produce(product, 0, undefined, [])).toThrow();
    expect(() => produce(product, -1, undefined, [])).toThrow();
    expect(() => produce(product, 1.5, undefined, [])).toThrow();
  });
});
