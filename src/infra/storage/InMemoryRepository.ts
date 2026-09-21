import type { Movement, Product, Recipe, Supply } from '../../domain/models';
import type {
  AdjustStockInput,
  AdjustStockResult,
  OperationDeps,
  RegisterProductionInput,
  RegisterProductionResult,
  RegisterSaleInput,
  RegisterSaleResult,
  RegisterSupplyPurchaseInput,
  RegisterSupplyPurchaseResult,
  UndoMovementResult,
} from '../../domain/operations';
import type { EstoqueRepository, EstoqueState } from './EstoqueRepository';
import {
  applyAdjustStock,
  applyRegisterProduction,
  applyRegisterSale,
  applyRegisterSupplyPurchase,
  applyUndoMovement,
} from './localMutations';

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

  async listProducts(): Promise<Product[]> {
    return this.state.products;
  }

  async saveProduct(product: Product): Promise<void> {
    const exists = this.state.products.some((p) => p.id === product.id);
    this.state = {
      ...this.state,
      products: exists
        ? this.state.products.map((p) => (p.id === product.id ? product : p))
        : [...this.state.products, product],
    };
  }

  async listSupplies(): Promise<Supply[]> {
    return this.state.supplies;
  }

  async saveSupply(supply: Supply): Promise<void> {
    const exists = this.state.supplies.some((s) => s.id === supply.id);
    this.state = {
      ...this.state,
      supplies: exists
        ? this.state.supplies.map((s) => (s.id === supply.id ? supply : s))
        : [...this.state.supplies, supply],
    };
  }

  async listRecipes(): Promise<Recipe[]> {
    return this.state.recipes;
  }

  async saveRecipe(recipe: Recipe): Promise<void> {
    const exists = this.state.recipes.some((r) => r.id === recipe.id);
    this.state = {
      ...this.state,
      recipes: exists
        ? this.state.recipes.map((r) => (r.id === recipe.id ? recipe : r))
        : [...this.state.recipes, recipe],
    };
  }

  async listMovements(): Promise<Movement[]> {
    return this.state.movements;
  }

  async registerSale(
    input: RegisterSaleInput,
    deps: OperationDeps = {},
  ): Promise<RegisterSaleResult> {
    const { state, result } = applyRegisterSale(this.state, input, deps);
    if (result.ok) this.state = state;
    return result;
  }

  async registerProduction(
    input: RegisterProductionInput,
    deps: OperationDeps = {},
  ): Promise<RegisterProductionResult> {
    const { state, result } = applyRegisterProduction(this.state, input, deps);
    if (result.ok) this.state = state;
    return result;
  }

  async registerSupplyPurchase(
    input: RegisterSupplyPurchaseInput,
    deps: OperationDeps = {},
  ): Promise<RegisterSupplyPurchaseResult> {
    const { state, result } = applyRegisterSupplyPurchase(this.state, input, deps);
    if (result.ok) this.state = state;
    return result;
  }

  async adjustStock(input: AdjustStockInput, deps: OperationDeps = {}): Promise<AdjustStockResult> {
    const { state, result } = applyAdjustStock(this.state, input, deps);
    if (result.ok) this.state = state;
    return result;
  }

  async undoMovement(movementId: string): Promise<UndoMovementResult> {
    const { state, result } = applyUndoMovement(this.state, movementId);
    if (result.ok) this.state = state;
    return result;
  }

  async getState(): Promise<EstoqueState> {
    return this.state;
  }

  async replaceState(state: EstoqueState): Promise<void> {
    this.state = state;
  }
}
