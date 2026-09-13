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

describe('histórico de exemplo da demonstração', () => {
  const now = new Date(2026, 8, 13, 15);
  const state = createDemoState(now);
  const productIds = new Set(state.products.map((p) => p.id));
  const supplyIds = new Set(state.supplies.map((s) => s.id));

  it('traz os quatro tipos de lançamento, só no passado e dentro de 75 dias', () => {
    const types = new Set(state.movements.map((m) => m.type));
    expect(types).toEqual(new Set(['sale', 'production', 'supply_purchase', 'adjustment']));
    const oldest = new Date(2026, 8, 13 - 75);
    for (const movement of state.movements) {
      const at = new Date(movement.occurredAt);
      expect(at < now).toBe(true);
      expect(at > oldest).toBe(true);
    }
  });

  it('todo lançamento aponta para uma vela ou um insumo que existe', () => {
    for (const movement of state.movements) {
      if (movement.productId) expect(productIds.has(movement.productId)).toBe(true);
      else expect(supplyIds.has(movement.supplyId!)).toBe(true);
    }
  });

  it('produção consome exatamente a ficha técnica da vela', () => {
    const production = state.movements.find((m) => m.type === 'production')!;
    const product = state.products.find((p) => p.id === production.productId)!;
    const recipe = state.recipes.find((r) => r.id === product.recipeId)!;
    expect(production.consumed).toEqual(
      recipe.items.map((i) => ({
        supplyId: i.supplyId,
        quantity: i.quantityPerUnit * production.quantity,
      })),
    );
  });

  it('é sempre o mesmo para a mesma data', () => {
    expect(createDemoState(now).movements).toEqual(state.movements);
  });

  it('deixa duas essências sem compra com valor, para mostrar o aviso de custo faltando', () => {
    const pricedSupplies = new Set(
      state.movements
        .filter((m) => m.type === 'supply_purchase' && m.totalCents !== undefined)
        .map((m) => m.supplyId),
    );
    const withoutCost = state.supplies.filter((s) => !pricedSupplies.has(s.id)).map((s) => s.name);
    expect(withoutCost.sort()).toEqual(['Essência Canela', 'Essência Santal']);
  });
});
