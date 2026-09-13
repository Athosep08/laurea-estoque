import type { Movement, Product, Recipe, Supply } from '../../domain/models';
import type { EstoqueState } from './EstoqueRepository';

/**
 * Dados do modo demonstração (`npm run dev:demo`). Espelham
 * `supabase/migrations/0002_carga_inicial.sql`: mesmas receitas, preços,
 * cera e as 9 essências que o stakeholder informou. Onde ele ainda não
 * respondeu (pavio, frascos, adesivos, velas prontas, as outras 5 essências e
 * os mínimos de alerta) os valores são EXEMPLO, só para dar para testar.
 *
 * Também traz 75 dias de histórico de EXEMPLO (vendas, produções, compras com
 * valor pago e ajustes com motivo), para os relatórios terem o que mostrar.
 * O histórico não recalcula o estoque: o estoque de hoje é o de cima, e os
 * lançamentos antigos são tratados como já refletidos nele.
 */

const CREATED_AT = '2026-09-11T00:00:00.000Z';

const MODELS = [
  {
    name: 'Clássica Liso 90g',
    frasco: 'Frasco 90g liso (com tampa)',
    cera: 80,
    essencia: 10,
    priceCents: 3590,
  },
  {
    name: 'Recipiente Fosco 200g',
    frasco: 'Frasco 200g fosco',
    cera: 180,
    essencia: 20,
    priceCents: 6590,
  },
  {
    name: 'Recipiente Refinado 200g',
    frasco: 'Frasco 200g canelado',
    cera: 180,
    essencia: 20,
    priceCents: 7590,
  },
];

/** Estoque de essência em gramas. Os 9 primeiros vieram do stakeholder; os 5 últimos são exemplo. */
const AROMAS: [string, number][] = [
  ['Café', 224],
  ['Apple Cake', 230],
  ['Lavanda', 300],
  ['Flor de Laranjeira', 34],
  ['Flor de Figo', 200],
  ['Bamboo', 120],
  ['Coco', 100],
  ['Cereja e Avelã', 260],
  ['Alecrim', 26],
  ['Capim Limão', 80],
  ['Bergamota', 150],
  ['Vanilla Prime', 90],
  ['Canela', 60],
  ['Santal', 120],
];

/** Velas prontas por recipiente, na ordem de AROMAS (exemplo). */
const READY: Record<string, number[]> = {
  'Clássica Liso 90g': [5, 3, 4, 0, 2, 2, 4, 3, 0, 2, 4, 2, 1, 3],
  'Recipiente Fosco 200g': [4, 2, 6, 0, 3, 3, 3, 2, 1, 1, 2, 1, 0, 2],
  'Recipiente Refinado 200g': [3, 1, 4, 1, 2, 2, 1, 2, 0, 0, 1, 1, 0, 2],
};

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function createDemoState(now: Date = new Date()): EstoqueState {
  const supplies: Supply[] = [];
  const addSupply = (name: string, unit: Supply['unit'], quantity: number, minQuantity: number) => {
    const supply: Supply = {
      id: `demo-${slug(name)}`,
      name,
      unit,
      quantity,
      minQuantity,
      createdAt: CREATED_AT,
    };
    supplies.push(supply);
    return supply.id;
  };

  const cera = addSupply('Cera de coco', 'g', 12000, 2000);
  const pavio = addSupply('Pavio', 'un', 20, 5);
  const ilhos = addSupply('Ilhós médio', 'un', 30, 10);
  const adesivoVela = addSupply('Adesivo da vela', 'un', 40, 10);
  addSupply('Adesivo da sacola', 'un', 35, 10);
  addSupply('Sacola', 'un', 25, 10);
  addSupply('Caixa', 'un', 6, 5);
  const frascos = new Map<string, string>([
    ['Frasco 90g liso (com tampa)', addSupply('Frasco 90g liso (com tampa)', 'un', 12, 4)],
    ['Frasco 200g fosco', addSupply('Frasco 200g fosco', 'un', 8, 4)],
    ['Frasco 200g canelado', addSupply('Frasco 200g canelado', 'un', 3, 4)],
  ]);
  const essencias = new Map(
    AROMAS.map(([aroma, grams]) => [aroma, addSupply(`Essência ${aroma}`, 'g', grams, 30)]),
  );

  const recipes: Recipe[] = [];
  const products: Product[] = [];
  for (const model of MODELS) {
    AROMAS.forEach(([aroma], index) => {
      const id = `demo-${slug(model.name)}-${slug(aroma)}`;
      recipes.push({
        id: `${id}-ficha`,
        name: `${model.name} ${aroma} — ficha técnica`,
        items: [
          { supplyId: cera, quantityPerUnit: model.cera },
          { supplyId: essencias.get(aroma)!, quantityPerUnit: model.essencia },
          { supplyId: pavio, quantityPerUnit: 0.5 },
          { supplyId: ilhos, quantityPerUnit: 1 },
          { supplyId: frascos.get(model.frasco)!, quantityPerUnit: 1 },
          { supplyId: adesivoVela, quantityPerUnit: 1 },
        ],
      });
      products.push({
        id,
        model: model.name,
        scent: aroma,
        priceCents: model.priceCents,
        quantity: READY[model.name][index],
        minQuantity: 1,
        recipeId: `${id}-ficha`,
        active: true,
        createdAt: CREATED_AT,
      });
    });
  }

  const movements = createDemoHistory(now, products, recipes, supplies);
  return { products, supplies, recipes, movements };
}

/** Compra padrão de cada insumo, com o valor pago (EXEMPLO). */
const STANDARD_PURCHASE: Record<string, { quantity: number; totalCents: number }> = {
  'Cera de coco': { quantity: 5000, totalCents: 30000 },
  'Frasco 90g liso (com tampa)': { quantity: 12, totalCents: 5400 },
  'Frasco 200g fosco': { quantity: 12, totalCents: 8160 },
  'Frasco 200g canelado': { quantity: 12, totalCents: 10680 },
  Pavio: { quantity: 30, totalCents: 1800 },
  'Ilhós médio': { quantity: 50, totalCents: 750 },
  'Adesivo da vela': { quantity: 100, totalCents: 3500 },
  'Adesivo da sacola': { quantity: 100, totalCents: 2500 },
  Sacola: { quantity: 50, totalCents: 6000 },
  Caixa: { quantity: 10, totalCents: 3500 },
};

/** Essências sem nenhuma compra com valor: mostram como o relatório avisa custo faltando. */
const ESSENCES_WITHOUT_COST = new Set(['Santal', 'Canela']);

/** Gerador pseudoaleatório com semente fixa: o histórico é sempre o mesmo. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createDemoHistory(
  now: Date,
  products: Product[],
  recipes: Recipe[],
  supplies: Supply[],
): Movement[] {
  const random = seededRandom(20260913);
  function pick<T>(items: T[], weights: number[]): T {
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  const supplyByName = new Map(supplies.map((s) => [s.name, s]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const popularity: Record<string, number> = {
    Lavanda: 6,
    Café: 5,
    'Flor de Figo': 3,
    Bamboo: 3,
    'Cereja e Avelã': 3,
    'Apple Cake': 2,
    Coco: 2,
  };
  const modelNames = MODELS.map((m) => m.name);
  const aromaNames = AROMAS.map(([aroma]) => aroma);
  const aromasWithCost = aromaNames.filter((a) => !ESSENCES_WITHOUT_COST.has(a));
  const productFor = (model: string, aroma: string) =>
    products.find((p) => p.model === model && p.scent === aroma)!;
  const randomProduct = () =>
    productFor(
      pick(modelNames, [5, 3, 2]),
      pick(
        aromaNames,
        aromaNames.map((a) => popularity[a] ?? 1),
      ),
    );

  const movements: Movement[] = [];
  const at = (daysAgo: number, hour: number) =>
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysAgo,
      hour,
      Math.floor(random() * 50),
    ).toISOString();
  const push = (movement: Omit<Movement, 'id' | 'undone'>) =>
    movements.push({ ...movement, id: `demo-historico-${movements.length + 1}`, undone: false });
  const purchase = (
    daysAgo: number,
    name: string,
    custom?: { quantity: number; totalCents?: number },
  ) => {
    const { quantity, totalCents } = custom ?? STANDARD_PURCHASE[name];
    push({
      type: 'supply_purchase',
      occurredAt: at(daysAgo, 9),
      supplyId: supplyByName.get(name)!.id,
      quantity,
      totalCents,
    });
  };
  const essence = (daysAgo: number, aroma: string) =>
    purchase(daysAgo, `Essência ${aroma}`, { quantity: 100, totalCents: 4000 });

  // Compras iniciais: dão custo a quase todos os insumos.
  for (const name of Object.keys(STANDARD_PURCHASE)) purchase(74, name);
  for (const aroma of aromasWithCost) essence(74, aroma);

  for (let daysAgo = 73; daysAgo >= 1; daysAgo--) {
    const salesToday = random() < 0.3 ? 0 : 1 + Math.floor(random() * 3);
    for (let i = 0; i < salesToday; i++) {
      const product = randomProduct();
      const quantity = random() < 0.8 ? 1 : 2;
      const full = product.priceCents * quantity;
      push({
        type: 'sale',
        occurredAt: at(daysAgo, 10 + i * 3),
        productId: product.id,
        quantity,
        totalCents: random() < 0.12 ? Math.round(full * 0.9) : full,
      });
    }

    if (daysAgo % 3 === 0) {
      const product = randomProduct();
      const quantity = 2 + Math.floor(random() * 5);
      const recipe = recipeById.get(product.recipeId!)!;
      push({
        type: 'production',
        occurredAt: at(daysAgo, 15),
        productId: product.id,
        quantity,
        consumed: recipe.items.map((item) => ({
          supplyId: item.supplyId,
          quantity: item.quantityPerUnit * quantity,
        })),
      });
    }

    if (daysAgo % 20 === 7) purchase(daysAgo, 'Cera de coco');
    if (daysAgo % 9 === 4) {
      essence(
        daysAgo,
        pick(
          aromasWithCost,
          aromasWithCost.map((a) => popularity[a] ?? 1),
        ),
      );
    }
    if (daysAgo % 15 === 2) {
      purchase(
        daysAgo,
        pick(
          ['Frasco 90g liso (com tampa)', 'Frasco 200g fosco', 'Frasco 200g canelado'],
          [5, 3, 2],
        ),
      );
    }
    if (daysAgo % 30 === 10) {
      for (const name of ['Sacola', 'Adesivo da sacola', 'Adesivo da vela'])
        purchase(daysAgo, name);
    }
    if (daysAgo % 30 === 25) {
      for (const name of ['Pavio', 'Ilhós médio', 'Caixa']) purchase(daysAgo, name);
    }
    // Uma compra sem valor pago: aparece no aviso do relatório de Gastos.
    if (daysAgo === 5) purchase(daysAgo, 'Sacola', { quantity: 20 });
  }

  const adjustProduct = (daysAgo: number, model: string, aroma: string, note: string) =>
    push({
      type: 'adjustment',
      occurredAt: at(daysAgo, 14),
      productId: productFor(model, aroma).id,
      quantity: -1,
      note,
    });
  adjustProduct(40, 'Recipiente Fosco 200g', 'Lavanda', 'Brinde');
  adjustProduct(33, 'Clássica Liso 90g', 'Café', 'Quebrou');
  adjustProduct(18, 'Recipiente Refinado 200g', 'Coco', 'Brinde');
  adjustProduct(9, 'Clássica Liso 90g', 'Bamboo', 'Sumiu');
  adjustProduct(4, 'Recipiente Fosco 200g', 'Café', 'Quebrou');
  push({
    type: 'adjustment',
    occurredAt: at(27, 16),
    supplyId: supplyByName.get('Essência Lavanda')!.id,
    quantity: -15,
    note: 'Derramou',
  });
  push({
    type: 'adjustment',
    occurredAt: at(12, 16),
    supplyId: supplyByName.get('Frasco 200g fosco')!.id,
    quantity: -1,
    note: 'Quebrou',
  });

  return movements.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
