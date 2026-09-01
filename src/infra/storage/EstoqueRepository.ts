import type { Movement, Product, Recipe, Supply } from '../../domain/models';

export type EstoqueState = {
  products: Product[];
  supplies: Supply[];
  recipes: Recipe[];
  movements: Movement[];
};

/**
 * A porta. `application/` só conhece esta interface — nunca uma
 * implementação concreta. Trocar localStorage por Supabase no futuro
 * significa escrever um novo adapter aqui, sem tocar em domain/ ou ui/.
 */
export interface EstoqueRepository {
  listProducts(): Product[];
  saveProduct(product: Product): void;

  listSupplies(): Supply[];
  saveSupply(supply: Supply): void;

  listRecipes(): Recipe[];
  saveRecipe(recipe: Recipe): void;

  listMovements(): Movement[];
  appendMovement(movement: Movement): void;
  updateMovement(movement: Movement): void;

  /** Usado por backup/restauração, que operam sobre o estado inteiro. */
  getState(): EstoqueState;
  replaceState(state: EstoqueState): void;
}
