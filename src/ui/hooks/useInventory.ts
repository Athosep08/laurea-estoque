import { useCallback, useMemo, useState } from 'react';
import type { Movement, Product, Recipe, Supply } from '../../domain/models';
import type { EstoqueRepository } from '../../infra/storage/EstoqueRepository';
import { registerSale, type RegisterSaleInput } from '../../application/registerSale';
import {
  registerProduction,
  type RegisterProductionInput,
} from '../../application/registerProduction';
import {
  registerSupplyPurchase,
  type RegisterSupplyPurchaseInput,
} from '../../application/registerSupplyPurchase';
import { adjustStock, type AdjustStockInput } from '../../application/adjustStock';
import { undoMovement } from '../../application/undoMovement';
import { getMonthlyReport } from '../../application/getMonthlyReport';

type InventoryData = {
  products: Product[];
  supplies: Supply[];
  recipes: Recipe[];
  movements: Movement[];
};

function readAll(repository: EstoqueRepository): InventoryData {
  return {
    products: repository.listProducts(),
    supplies: repository.listSupplies(),
    recipes: repository.listRecipes(),
    movements: repository.listMovements(),
  };
}

/**
 * Ponte entre a UI e os casos de uso de `application/`. A UI nunca chama o
 * repositório direto — sempre por aqui. Cada ação recarrega o estado local
 * depois de rodar o caso de uso, então os componentes só leem `products`,
 * `supplies` etc. e não se preocupam em invalidar cache manualmente.
 */
export function useInventory(repository: EstoqueRepository) {
  const [data, setData] = useState<InventoryData>(() => readAll(repository));

  const reload = useCallback(() => setData(readAll(repository)), [repository]);

  const sell = useCallback(
    (input: RegisterSaleInput) => {
      const result = registerSale(repository, input);
      reload();
      return result;
    },
    [repository, reload],
  );

  const produce = useCallback(
    (input: RegisterProductionInput) => {
      const result = registerProduction(repository, input);
      reload();
      return result;
    },
    [repository, reload],
  );

  const purchaseSupply = useCallback(
    (input: RegisterSupplyPurchaseInput) => {
      const result = registerSupplyPurchase(repository, input);
      reload();
      return result;
    },
    [repository, reload],
  );

  const adjust = useCallback(
    (input: AdjustStockInput) => {
      const result = adjustStock(repository, input);
      reload();
      return result;
    },
    [repository, reload],
  );

  const undo = useCallback(
    (movementId: string) => {
      const result = undoMovement(repository, movementId);
      reload();
      return result;
    },
    [repository, reload],
  );

  const saveProduct = useCallback(
    (product: Product) => {
      repository.saveProduct(product);
      reload();
    },
    [repository, reload],
  );

  const saveSupply = useCallback(
    (supply: Supply) => {
      repository.saveSupply(supply);
      reload();
    },
    [repository, reload],
  );

  const saveRecipe = useCallback(
    (recipe: Recipe) => {
      repository.saveRecipe(recipe);
      reload();
    },
    [repository, reload],
  );

  const report = useCallback(
    (year: number, month: number) => getMonthlyReport(repository, year, month),
    [repository],
  );

  return useMemo(
    () => ({
      ...data,
      reload,
      sell,
      produce,
      purchaseSupply,
      adjust,
      undo,
      saveProduct,
      saveSupply,
      saveRecipe,
      report,
    }),
    [
      data,
      reload,
      sell,
      produce,
      purchaseSupply,
      adjust,
      undo,
      saveProduct,
      saveSupply,
      saveRecipe,
      report,
    ],
  );
}

export type UseInventoryReturn = ReturnType<typeof useInventory>;
