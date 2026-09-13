export type UUID = string;
/** Sempre inteiro. Nunca usar float para representar dinheiro. */
export type Cents = number;
/** Formato ISO 8601, ex.: '2026-09-01T14:32:00.000Z' */
export type ISODate = string;

export type Product = {
  id: UUID;
  model: string; // 'Clássica Liso 90g' | 'Personalizada' | ...
  scent: string; // 'Lavanda'
  priceCents: Cents;
  quantity: number; // inteiro >= 0
  minQuantity: number; // limiar de alerta
  recipeId?: UUID; // ficha técnica; ausente = sem baixa automática
  active: boolean;
  createdAt: ISODate;
};

export type SupplyUnit = 'kg' | 'g' | 'L' | 'ml' | 'un';

export type Supply = {
  id: UUID;
  name: string; // 'Cera vegetal'
  unit: SupplyUnit;
  quantity: number; // pode ser fracionário (0.75 kg)
  minQuantity: number;
  createdAt: ISODate;
};

/** Ficha técnica: o que uma unidade do produto consome. */
export type Recipe = {
  id: UUID;
  name: string; // 'Fosco 200g'
  items: RecipeItem[];
};

export type RecipeItem = {
  supplyId: UUID;
  quantityPerUnit: number; // ex.: 0.18 kg de cera por vela
};

export type MovementType = 'production' | 'sale' | 'adjustment' | 'supply_purchase';

export type ConsumedSupply = { supplyId: UUID; quantity: number };

export type Movement = {
  id: UUID;
  type: MovementType;
  occurredAt: ISODate;
  productId?: UUID; // production | sale | adjustment de produto
  supplyId?: UUID; // supply_purchase | adjustment de insumo
  quantity: number; // SEMPRE positivo; o tipo define o sinal
  totalCents?: Cents; // 'sale': valor recebido; 'supply_purchase': valor pago (opcional)
  consumed?: ConsumedSupply[]; // apenas em 'production', para permitir desfazer
  note?: string;
  undone: boolean; // soft delete — histórico não se apaga
};
