import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ConsumedSupply,
  Movement,
  MovementType,
  Product,
  Recipe,
  Supply,
  SupplyUnit,
} from '../../domain/models';
import type {
  AdjustStockInput,
  AdjustStockResult,
  RegisterProductionInput,
  RegisterProductionResult,
  RegisterSaleInput,
  RegisterSaleResult,
  RegisterSupplyPurchaseInput,
  RegisterSupplyPurchaseResult,
  UndoMovementResult,
} from '../../domain/operations';
import type { EstoqueRepository, EstoqueState } from './EstoqueRepository';

type ProductRow = {
  id: string;
  model: string;
  scent: string;
  price_cents: number;
  quantity: number;
  min_quantity: number;
  recipe_id: string | null;
  active: boolean;
  created_at: string;
};

type SupplyRow = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  created_at: string;
};

type RecipeRow = {
  id: string;
  name: string;
  recipe_items: { supply_id: string; quantity_per_unit: number }[] | null;
};

type MovementRow = {
  id: string;
  type: string;
  occurred_at: string;
  product_id: string | null;
  supply_id: string | null;
  quantity: number;
  total_cents: number | null;
  note: string | null;
  undone: boolean;
};

type ConsumedSupplyRow = { supply_id: string; quantity: number };

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    model: row.model,
    scent: row.scent,
    priceCents: row.price_cents,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    recipeId: row.recipe_id ?? undefined,
    active: row.active,
    createdAt: row.created_at,
  };
}

function fromProduct(product: Product) {
  return {
    id: product.id,
    model: product.model,
    scent: product.scent,
    price_cents: product.priceCents,
    quantity: product.quantity,
    min_quantity: product.minQuantity,
    recipe_id: product.recipeId ?? null,
    active: product.active,
    created_at: product.createdAt,
  };
}

function toSupply(row: SupplyRow): Supply {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit as SupplyUnit,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    createdAt: row.created_at,
  };
}

function fromSupply(supply: Supply) {
  return {
    id: supply.id,
    name: supply.name,
    unit: supply.unit,
    quantity: supply.quantity,
    min_quantity: supply.minQuantity,
    created_at: supply.createdAt,
  };
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    items: (row.recipe_items ?? []).map((item) => ({
      supplyId: item.supply_id,
      quantityPerUnit: item.quantity_per_unit,
    })),
  };
}

function toMovement(row: MovementRow, consumed?: ConsumedSupply[]): Movement {
  return {
    id: row.id,
    type: row.type as MovementType,
    occurredAt: row.occurred_at,
    productId: row.product_id ?? undefined,
    supplyId: row.supply_id ?? undefined,
    quantity: row.quantity,
    totalCents: row.total_cents ?? undefined,
    consumed: consumed && consumed.length > 0 ? consumed : undefined,
    note: row.note ?? undefined,
    undone: row.undone,
  };
}

/** Corpo das exceções lançadas pelas funções RPC: sempre um JSON `{ reason, ...detalhes }`. */
function parseRpcError(message: string): { reason: string; [key: string]: unknown } {
  try {
    return JSON.parse(message);
  } catch {
    return { reason: 'unknown_error' };
  }
}

/**
 * Adapter que fala com o Postgres do Supabase. Leitura e cadastro simples
 * (saveProduct/saveSupply/saveRecipe) são upserts diretos — não há disputa de
 * concorrência real em editar o nome de um produto. As cinco mutações de
 * estoque (venda, produção, compra, ajuste, desfazer) chamam funções RPC que
 * fazem `select ... for update` no Postgres antes de validar: é isso que
 * impede estoque negativo com dois aparelhos escrevendo ao mesmo tempo. A
 * mesma regra de negócio (não pode ficar negativo, precisa de insumo
 * suficiente) existe também em `domain/`, em TypeScript — usada pelo adapter
 * local e pelos testes — mas aqui a fonte de verdade final é a função SQL.
 */
export class SupabaseEstoqueRepository implements EstoqueRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listProducts(): Promise<Product[]> {
    const { data, error } = await this.client.from('products').select('*');
    if (error) throw error;
    return (data as ProductRow[]).map(toProduct);
  }

  async saveProduct(product: Product): Promise<void> {
    const { error } = await this.client.from('products').upsert(fromProduct(product));
    if (error) throw error;
  }

  async listSupplies(): Promise<Supply[]> {
    const { data, error } = await this.client.from('supplies').select('*');
    if (error) throw error;
    return (data as SupplyRow[]).map(toSupply);
  }

  async saveSupply(supply: Supply): Promise<void> {
    const { error } = await this.client.from('supplies').upsert(fromSupply(supply));
    if (error) throw error;
  }

  async listRecipes(): Promise<Recipe[]> {
    const { data, error } = await this.client
      .from('recipes')
      .select('id, name, recipe_items(supply_id, quantity_per_unit)');
    if (error) throw error;
    return (data as RecipeRow[]).map(toRecipe);
  }

  async saveRecipe(recipe: Recipe): Promise<void> {
    const { error: recipeError } = await this.client
      .from('recipes')
      .upsert({ id: recipe.id, name: recipe.name });
    if (recipeError) throw recipeError;

    const { error: deleteError } = await this.client
      .from('recipe_items')
      .delete()
      .eq('recipe_id', recipe.id);
    if (deleteError) throw deleteError;

    if (recipe.items.length === 0) return;

    const { error: insertError } = await this.client.from('recipe_items').insert(
      recipe.items.map((item) => ({
        recipe_id: recipe.id,
        supply_id: item.supplyId,
        quantity_per_unit: item.quantityPerUnit,
      })),
    );
    if (insertError) throw insertError;
  }

  async listMovements(): Promise<Movement[]> {
    const { data, error } = await this.client
      .from('movements')
      .select('*, consumed_supplies(supply_id, quantity)')
      .order('occurred_at', { ascending: false });
    if (error) throw error;

    return (data as (MovementRow & { consumed_supplies: ConsumedSupplyRow[] })[]).map((row) =>
      toMovement(
        row,
        row.consumed_supplies.map((c) => ({ supplyId: c.supply_id, quantity: c.quantity })),
      ),
    );
  }

  async registerSale(input: RegisterSaleInput): Promise<RegisterSaleResult> {
    const { data, error } = await this.client.rpc('register_sale', {
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_total_cents: input.totalCents ?? null,
      p_note: input.note ?? null,
    });
    if (error) {
      const parsed = parseRpcError(error.message);
      if (parsed.reason === 'product_not_found') return { ok: false, reason: 'product_not_found' };
      if (parsed.reason === 'insufficient_stock') {
        return {
          ok: false,
          reason: 'insufficient_stock',
          available: parsed.available as number,
          requested: parsed.requested as number,
        };
      }
      throw error;
    }
    return { ok: true, movement: toMovement(data as MovementRow) };
  }

  async registerProduction(input: RegisterProductionInput): Promise<RegisterProductionResult> {
    const { data, error } = await this.client.rpc('register_production', {
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_note: input.note ?? null,
    });
    if (error) {
      const parsed = parseRpcError(error.message);
      if (parsed.reason === 'product_not_found') return { ok: false, reason: 'product_not_found' };
      if (parsed.reason === 'missing_supplies') {
        return {
          ok: false,
          reason: 'missing_supplies',
          missing: (
            parsed.missing as { supplyId: string; required: number; available: number }[]
          ).map((m) => ({ supplyId: m.supplyId, required: m.required, available: m.available })),
        };
      }
      throw error;
    }

    const movementRow = data as MovementRow;
    const { data: consumedRows, error: consumedError } = await this.client
      .from('consumed_supplies')
      .select('supply_id, quantity')
      .eq('movement_id', movementRow.id);
    if (consumedError) throw consumedError;

    const consumed = (consumedRows as ConsumedSupplyRow[]).map((c) => ({
      supplyId: c.supply_id,
      quantity: c.quantity,
    }));
    return { ok: true, movement: toMovement(movementRow, consumed) };
  }

  async registerSupplyPurchase(
    input: RegisterSupplyPurchaseInput,
  ): Promise<RegisterSupplyPurchaseResult> {
    const { data, error } = await this.client.rpc('register_supply_purchase', {
      p_supply_id: input.supplyId,
      p_quantity: input.quantity,
      p_total_cents: input.totalCents ?? null,
      p_note: input.note ?? null,
    });
    if (error) {
      const parsed = parseRpcError(error.message);
      if (parsed.reason === 'supply_not_found') return { ok: false, reason: 'supply_not_found' };
      throw error;
    }
    return { ok: true, movement: toMovement(data as MovementRow) };
  }

  async adjustStock(input: AdjustStockInput): Promise<AdjustStockResult> {
    const { data, error } = await this.client.rpc('adjust_stock', {
      p_target: input.target,
      p_id: input.id,
      p_delta: input.delta,
      p_note: input.note,
    });
    if (error) {
      const parsed = parseRpcError(error.message);
      if (parsed.reason === 'not_found') return { ok: false, reason: 'not_found' };
      if (parsed.reason === 'note_required') return { ok: false, reason: 'note_required' };
      if (parsed.reason === 'negative_result') {
        return { ok: false, reason: 'negative_result', resulting: parsed.resulting as number };
      }
      throw error;
    }
    return { ok: true, movement: toMovement(data as MovementRow) };
  }

  async undoMovement(movementId: string): Promise<UndoMovementResult> {
    const { error } = await this.client.rpc('undo_movement', { p_movement_id: movementId });
    if (error) {
      const parsed = parseRpcError(error.message);
      if (parsed.reason === 'not_found') return { ok: false, reason: 'not_found' };
      if (parsed.reason === 'already_undone') return { ok: false, reason: 'already_undone' };
      if (parsed.reason === 'negative_result') {
        return { ok: false, reason: 'negative_result', resulting: parsed.resulting as number };
      }
      throw error;
    }
    return { ok: true };
  }

  async getState(): Promise<EstoqueState> {
    const [products, supplies, recipes, movements] = await Promise.all([
      this.listProducts(),
      this.listSupplies(),
      this.listRecipes(),
      this.listMovements(),
    ]);
    return { products, supplies, recipes, movements };
  }

  async replaceState(state: EstoqueState): Promise<void> {
    const { error } = await this.client.rpc('replace_state', { p_state: state });
    if (error) throw error;
  }

  async eraseAll(): Promise<void> {
    const { error } = await this.client.rpc('erase_all');
    if (error) throw error;
  }
}
