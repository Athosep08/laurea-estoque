import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type InventoryData = {
  products: Product[];
  supplies: Supply[];
  recipes: Recipe[];
  movements: Movement[];
};

const EMPTY_DATA: InventoryData = { products: [], supplies: [], recipes: [], movements: [] };

async function readAll(repository: EstoqueRepository): Promise<InventoryData> {
  const [products, supplies, recipes, movements] = await Promise.all([
    repository.listProducts(),
    repository.listSupplies(),
    repository.listRecipes(),
    repository.listMovements(),
  ]);
  return { products, supplies, recipes, movements };
}

/**
 * Ponte entre a UI e os casos de uso de `application/`. A UI nunca chama o
 * repositório direto — sempre por aqui. Cada ação recarrega o estado
 * (agora vindo do Supabase, via rede) depois de rodar o caso de uso, então
 * os componentes só leem `products`, `supplies` etc. e não se preocupam em
 * invalidar cache manualmente. `loading`/`error` cobrem a carga inicial e
 * qualquer falha de rede ao recarregar.
 */
export function useInventory(repository: EstoqueRepository) {
  const [data, setData] = useState<InventoryData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const next = await readAll(repository);
      if (mounted.current) {
        setData(next);
        setError(null);
      }
    } catch {
      if (mounted.current) {
        setError('Não foi possível carregar os dados. Verifique sua conexão.');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [repository]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  // Dois celulares usam o mesmo estoque. Sem isso, o que um lançou só aparecia
  // no outro quando o app fosse fechado e aberto de novo — e no iPhone, voltar
  // para um app em segundo plano não reabre nada. Recarrega ao voltar para a
  // tela e quando a conexão volta.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [reload]);

  const sell = useCallback(
    async (input: RegisterSaleInput) => {
      const result = await registerSale(repository, input);
      await reload();
      return result;
    },
    [repository, reload],
  );

  const produce = useCallback(
    async (input: RegisterProductionInput) => {
      const result = await registerProduction(repository, input);
      await reload();
      return result;
    },
    [repository, reload],
  );

  const purchaseSupply = useCallback(
    async (input: RegisterSupplyPurchaseInput) => {
      const result = await registerSupplyPurchase(repository, input);
      await reload();
      return result;
    },
    [repository, reload],
  );

  const adjust = useCallback(
    async (input: AdjustStockInput) => {
      const result = await adjustStock(repository, input);
      await reload();
      return result;
    },
    [repository, reload],
  );

  const undo = useCallback(
    async (movementId: string) => {
      const result = await undoMovement(repository, movementId);
      await reload();
      return result;
    },
    [repository, reload],
  );

  const saveProduct = useCallback(
    async (product: Product) => {
      await repository.saveProduct(product);
      await reload();
    },
    [repository, reload],
  );

  const saveSupply = useCallback(
    async (supply: Supply) => {
      await repository.saveSupply(supply);
      await reload();
    },
    [repository, reload],
  );

  const saveRecipe = useCallback(
    async (recipe: Recipe) => {
      await repository.saveRecipe(recipe);
      await reload();
    },
    [repository, reload],
  );

  return useMemo(
    () => ({
      ...data,
      loading,
      error,
      reload,
      sell,
      produce,
      purchaseSupply,
      adjust,
      undo,
      saveProduct,
      saveSupply,
      saveRecipe,
    }),
    [
      data,
      loading,
      error,
      reload,
      sell,
      produce,
      purchaseSupply,
      adjust,
      undo,
      saveProduct,
      saveSupply,
      saveRecipe,
    ],
  );
}

export type UseInventoryReturn = ReturnType<typeof useInventory>;
