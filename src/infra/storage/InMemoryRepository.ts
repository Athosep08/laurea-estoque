import type { Movement, Product, Recipe, Supply } from '../../domain/models';
import type { EstoqueRepository, EstoqueState } from './EstoqueRepository';

/**
 * Fake em memória usado nos testes de `application/`. Implementa a mesma
 * porta que `LocalStorageRepository`, então os casos de uso são testados
 * sem depender do DOM.
 */
export class InMemoryRepository implements EstoqueRepository {
  private state: EstoqueState;

  constructor(initial: Partial<EstoqueState> = {}) {
    this.state = {
      products: initial.products ?? [],
      supplies: initial.supplies ?? [],
      recipes: initial.recipes ?? [],
      movements: initial.movements ?? [],
    };
  }

  listProducts(): Product[] {
    return this.state.products;
  }

  saveProduct(product: Product): void {
    const exists = this.state.products.some((p) => p.id === product.id);
    this.state = {
      ...this.state,
      products: exists
        ? this.state.products.map((p) => (p.id === product.id ? product : p))
        : [...this.state.products, product],
    };
  }

  listSupplies(): Supply[] {
    return this.state.supplies;
  }

  saveSupply(supply: Supply): void {
    const exists = this.state.supplies.some((s) => s.id === supply.id);
    this.state = {
      ...this.state,
      supplies: exists
        ? this.state.supplies.map((s) => (s.id === supply.id ? supply : s))
        : [...this.state.supplies, supply],
    };
  }

  listRecipes(): Recipe[] {
    return this.state.recipes;
  }

  saveRecipe(recipe: Recipe): void {
    const exists = this.state.recipes.some((r) => r.id === recipe.id);
    this.state = {
      ...this.state,
      recipes: exists
        ? this.state.recipes.map((r) => (r.id === recipe.id ? recipe : r))
        : [...this.state.recipes, recipe],
    };
  }

  listMovements(): Movement[] {
    return this.state.movements;
  }

  appendMovement(movement: Movement): void {
    this.state = { ...this.state, movements: [...this.state.movements, movement] };
  }

  updateMovement(movement: Movement): void {
    this.state = {
      ...this.state,
      movements: this.state.movements.map((m) => (m.id === movement.id ? movement : m)),
    };
  }

  getState(): EstoqueState {
    return this.state;
  }

  replaceState(state: EstoqueState): void {
    this.state = state;
  }
}
