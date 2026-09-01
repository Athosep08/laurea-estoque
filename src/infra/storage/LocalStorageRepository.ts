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

  async listProducts(): Promise<Product[]> {
    return this.read().products;
  }

  async saveProduct(product: Product): Promise<void> {
    const state = this.read();
    const exists = state.products.some((p) => p.id === product.id);
    const products = exists
      ? state.products.map((p) => (p.id === product.id ? product : p))
      : [...state.products, product];
    this.write({ ...state, products });
  }

  async listSupplies(): Promise<Supply[]> {
    return this.read().supplies;
  }

  async saveSupply(supply: Supply): Promise<void> {
    const state = this.read();
    const exists = state.supplies.some((s) => s.id === supply.id);
    const supplies = exists
      ? state.supplies.map((s) => (s.id === supply.id ? supply : s))
      : [...state.supplies, supply];
    this.write({ ...state, supplies });
  }

  async listRecipes(): Promise<Recipe[]> {
    return this.read().recipes;
  }

  async saveRecipe(recipe: Recipe): Promise<void> {
    const state = this.read();
    const exists = state.recipes.some((r) => r.id === recipe.id);
    const recipes = exists
      ? state.recipes.map((r) => (r.id === recipe.id ? recipe : r))
      : [...state.recipes, recipe];
    this.write({ ...state, recipes });
  }

  async listMovements(): Promise<Movement[]> {
    return this.read().movements;
  }

  async registerSale(
    input: RegisterSaleInput,
    deps: OperationDeps = {},
  ): Promise<RegisterSaleResult> {
    const { state, result } = applyRegisterSale(this.read(), input, deps);
    if (result.ok) this.write(state);
    return result;
  }

  async registerProduction(
    input: RegisterProductionInput,
    deps: OperationDeps = {},
  ): Promise<RegisterProductionResult> {
    const { state, result } = applyRegisterProduction(this.read(), input, deps);
    if (result.ok) this.write(state);
    return result;
  }

  async registerSupplyPurchase(
    input: RegisterSupplyPurchaseInput,
    deps: OperationDeps = {},
  ): Promise<RegisterSupplyPurchaseResult> {
    const { state, result } = applyRegisterSupplyPurchase(this.read(), input, deps);
    if (result.ok) this.write(state);
    return result;
  }

  async adjustStock(input: AdjustStockInput, deps: OperationDeps = {}): Promise<AdjustStockResult> {
    const { state, result } = applyAdjustStock(this.read(), input, deps);
    if (result.ok) this.write(state);
    return result;
  }

  async undoMovement(movementId: string): Promise<UndoMovementResult> {
    const { state, result } = applyUndoMovement(this.read(), movementId);
    if (result.ok) this.write(state);
    return result;
  }

  async getState(): Promise<EstoqueState> {
    return this.read();
  }

  async replaceState(state: EstoqueState): Promise<void> {
    this.write(state);
  }

  async eraseAll(): Promise<void> {
    this.write(createEmptyState());
  }
}
