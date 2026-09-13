import { describe, expect, it } from 'vitest';
import { createDemoState } from '../demoSeed';

describe('createDemoState', () => {
  const state = createDemoState();

  it('tem os 42 produtos (3 recipientes × 14 aromas) e os 24 insumos do seed', () => {
    expect(state.products).toHaveLength(42);
    expect(state.supplies).toHaveLength(24);
    expect(new Set(state.products.map((p) => p.model))).toEqual(
      new Set(['Clássica Liso 90g', 'Recipiente Fosco 200g', 'Recipiente Refinado 200g']),
    );
  });

  it('usa os preços da landing page, que só dependem do recipiente', () => {
    const priceOf = (model: string) =>
      new Set(state.products.filter((p) => p.model === model).map((p) => p.priceCents));
    expect(priceOf('Clássica Liso 90g')).toEqual(new Set([3590]));
    expect(priceOf('Recipiente Fosco 200g')).toEqual(new Set([6590]));
    expect(priceOf('Recipiente Refinado 200g')).toEqual(new Set([7590]));
  });

  it('dá a cada vela a própria ficha técnica, apontando só para insumos que existem', () => {
    const supplyIds = new Set(state.supplies.map((s) => s.id));
    for (const product of state.products) {
      const recipe = state.recipes.find((r) => r.id === product.recipeId);
      expect(recipe?.items).toHaveLength(6);
      for (const item of recipe!.items) expect(supplyIds.has(item.supplyId)).toBe(true);
    }
    expect(new Set(state.products.map((p) => p.recipeId)).size).toBe(42);
  });

  it('segue as receitas do stakeholder: 80 g + 10 g na 90g, 180 g + 20 g nas 200g', () => {
    const recipeOf = (model: string, scent: string) => {
      const product = state.products.find((p) => p.model === model && p.scent === scent)!;
      return state.recipes.find((r) => r.id === product.recipeId)!.items;
    };
    const cera = state.supplies.find((s) => s.name === 'Cera de coco')!.id;
    const lavanda = state.supplies.find((s) => s.name === 'Essência Lavanda')!.id;
    const qty = (items: { supplyId: string; quantityPerUnit: number }[], id: string) =>
      items.find((i) => i.supplyId === id)?.quantityPerUnit;

    expect(qty(recipeOf('Clássica Liso 90g', 'Lavanda'), cera)).toBe(80);
    expect(qty(recipeOf('Clássica Liso 90g', 'Lavanda'), lavanda)).toBe(10);
    expect(qty(recipeOf('Recipiente Refinado 200g', 'Lavanda'), cera)).toBe(180);
    expect(qty(recipeOf('Recipiente Refinado 200g', 'Lavanda'), lavanda)).toBe(20);
  });
});
