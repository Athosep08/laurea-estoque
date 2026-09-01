import type { Movement, Product, Recipe, Supply } from '../../domain/models';
import type { EstoqueRepository, EstoqueState } from './EstoqueRepository';
import { createEmptyState, migrate, toPersisted } from './schema';

const STORAGE_KEY = 'laurea-estoque';

/** Adapter v1 da porta EstoqueRepository. Todo o estado vive numa única chave. */
export class LocalStorageRepository implements EstoqueRepository {
  private read(): EstoqueState {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    try {
      return migrate(JSON.parse(raw));
    } catch {
      return createEmptyState();
    }
  }

  private write(state: EstoqueState): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state)));
  }

  listProducts(): Product[] {
    return this.read().products;
  }

  saveProduct(product: Product): void {
    const state = this.read();
    const exists = state.products.some((p) => p.id === product.id);
    const products = exists
      ? state.products.map((p) => (p.id === product.id ? product : p))
      : [...state.products, product];
    this.write({ ...state, products });
  }

  listSupplies(): Supply[] {
    return this.read().supplies;
  }

  saveSupply(supply: Supply): void {
    const state = this.read();
    const exists = state.supplies.some((s) => s.id === supply.id);
    const supplies = exists
      ? state.supplies.map((s) => (s.id === supply.id ? supply : s))
      : [...state.supplies, supply];
    this.write({ ...state, supplies });
  }

  listRecipes(): Recipe[] {
    return this.read().recipes;
  }

  saveRecipe(recipe: Recipe): void {
    const state = this.read();
    const exists = state.recipes.some((r) => r.id === recipe.id);
    const recipes = exists
      ? state.recipes.map((r) => (r.id === recipe.id ? recipe : r))
      : [...state.recipes, recipe];
    this.write({ ...state, recipes });
  }

  listMovements(): Movement[] {
    return this.read().movements;
  }

  appendMovement(movement: Movement): void {
    const state = this.read();
    this.write({ ...state, movements: [...state.movements, movement] });
  }

  updateMovement(movement: Movement): void {
    const state = this.read();
    const movements = state.movements.map((m) => (m.id === movement.id ? movement : m));
    this.write({ ...state, movements });
  }

  getState(): EstoqueState {
    return this.read();
  }

  replaceState(state: EstoqueState): void {
    this.write(state);
  }
}
