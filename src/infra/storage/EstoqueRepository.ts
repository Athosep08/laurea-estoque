import type { Movement, Product, Recipe, Supply, UUID } from '../../domain/models';
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

export type EstoqueState = {
  products: Product[];
  supplies: Supply[];
  recipes: Recipe[];
  movements: Movement[];
};

/**
 * A porta. `application/` só conhece esta interface — nunca uma
 * implementação concreta. `LocalStorageRepository`/`InMemoryRepository`
 * rodam tudo em processo; `SupabaseEstoqueRepository` delega as mutações a
 * funções RPC no Postgres, que fazem `select ... for update` antes de
 * validar — é isso que impede estoque negativo com dois aparelhos escrevendo
 * ao mesmo tempo. Por isso as mutações de estoque não são um simples
 * "ler o estado, calcular, salvar de volta" genérico: são métodos próprios,
 * porque só a implementação sabe como garantir atomicidade.
 */
export interface EstoqueRepository {
  listProducts(): Promise<Product[]>;
  saveProduct(product: Product): Promise<void>;

  listSupplies(): Promise<Supply[]>;
  saveSupply(supply: Supply): Promise<void>;

  listRecipes(): Promise<Recipe[]>;
  saveRecipe(recipe: Recipe): Promise<void>;

  listMovements(): Promise<Movement[]>;

  registerSale(input: RegisterSaleInput, deps?: OperationDeps): Promise<RegisterSaleResult>;
  registerProduction(
    input: RegisterProductionInput,
    deps?: OperationDeps,
  ): Promise<RegisterProductionResult>;
  registerSupplyPurchase(
    input: RegisterSupplyPurchaseInput,
    deps?: OperationDeps,
  ): Promise<RegisterSupplyPurchaseResult>;
  adjustStock(input: AdjustStockInput, deps?: OperationDeps): Promise<AdjustStockResult>;
  undoMovement(movementId: UUID): Promise<UndoMovementResult>;

  /** Usado por backup/restauração, que operam sobre o estado inteiro. */
  getState(): Promise<EstoqueState>;
  replaceState(state: EstoqueState): Promise<void>;
  eraseAll(): Promise<void>;
}
