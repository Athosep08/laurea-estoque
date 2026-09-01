import type { Movement, Product, Recipe, Supply } from '../models';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: nextId('product'),
    model: 'Clássica Liso 90g',
    scent: 'Lavanda',
    priceCents: 3590,
    quantity: 10,
    minQuantity: 3,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeSupply(overrides: Partial<Supply> = {}): Supply {
  return {
    id: nextId('supply'),
    name: 'Cera vegetal',
    unit: 'kg',
    quantity: 10,
    minQuantity: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: nextId('recipe'),
    name: 'Fosco 200g',
    items: [],
    ...overrides,
  };
}

export function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: nextId('movement'),
    type: 'sale',
    occurredAt: '2026-01-15T12:00:00.000Z',
    quantity: 1,
    undone: false,
    ...overrides,
  };
}
