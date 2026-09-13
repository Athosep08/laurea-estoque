import type { Product, Recipe, Supply } from '../../domain/models';
import type { EstoqueState } from './EstoqueRepository';

/**
 * Dados do modo demonstração (`npm run dev:demo`). Espelham
 * `supabase/migrations/0002_carga_inicial.sql`: mesmas receitas, preços,
 * cera e as 9 essências que o stakeholder informou. Onde ele ainda não
 * respondeu (pavio, frascos, adesivos, velas prontas, as outras 5 essências e
 * os mínimos de alerta) os valores são EXEMPLO, só para dar para testar.
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

export function createDemoState(): EstoqueState {
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

  return { products, supplies, recipes, movements: [] };
}
