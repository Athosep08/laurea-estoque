import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../App';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import type { Product, Recipe, Supply } from '../../domain/models';

const CREATED_AT = '2026-09-11T00:00:00.000Z';

function product(
  id: string,
  model: string,
  scent: string,
  priceCents: number,
  quantity: number,
  extra: Partial<Product> = {},
): Product {
  return {
    id,
    model,
    scent,
    priceCents,
    quantity,
    minQuantity: 0,
    active: true,
    createdAt: CREATED_AT,
    ...extra,
  };
}

function supply(
  id: string,
  name: string,
  unit: Supply['unit'],
  quantity: number,
  minQuantity = 0,
): Supply {
  return { id, name, unit, quantity, minQuantity, createdAt: CREATED_AT };
}

/** Catálogo pequeno: 2 recipientes, estoques variados, uma ficha técnica com essência faltando. */
function renderApp() {
  const recipes: Recipe[] = [
    {
      id: 'r-fosco-lavanda',
      name: 'Fosco Lavanda',
      items: [
        { supplyId: 's-cera', quantityPerUnit: 180 },
        { supplyId: 's-lavanda', quantityPerUnit: 20 },
      ],
    },
  ];
  const repository = new InMemoryRepository({
    products: [
      product('p1', 'Clássica Liso 90g', 'Café', 3590, 5),
      product('p2', 'Clássica Liso 90g', 'Lavanda', 3590, 1, { minQuantity: 2 }),
      product('p3', 'Recipiente Fosco 200g', 'Café', 6590, 5),
      product('p4', 'Recipiente Fosco 200g', 'Flor de Figo', 6590, 5),
      product('p5', 'Recipiente Fosco 200g', 'Lavanda', 6590, 5, { recipeId: 'r-fosco-lavanda' }),
      product('p6', 'Recipiente Fosco 200g', 'Santal', 6590, 0),
    ],
    supplies: [
      supply('s-cera', 'Cera de coco', 'g', 1000),
      supply('s-lavanda', 'Essência Lavanda', 'g', 15, 30),
      supply('s-frasco', 'Frasco 200g fosco', 'un', 10),
    ],
    recipes,
  });
  render(<AppShell repository={repository} />);
}

async function sellFoscoLavanda(user: ReturnType<typeof userEvent.setup>, quantity: string) {
  await user.click(await screen.findByRole('button', { name: /Vender/ }));
  await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));
  await user.click(screen.getByRole('button', { name: /Lavanda/ }));
  await user.clear(screen.getByLabelText('Quantidade vendida'));
  await user.type(screen.getByLabelText('Quantidade vendida'), quantity);
  await user.click(screen.getByRole('button', { name: 'Registrar venda' }));
}

describe('Início: lançamentos', () => {
  it('pergunta o que vai ser lançado, com as quatro ações', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'O que você vai lançar?' }),
    ).toBeInTheDocument();
    for (const action of ['Vender', 'Produzir', 'Entrada de insumo', 'Ajustar']) {
      expect(screen.getByRole('button', { name: new RegExp(action) })).toBeInTheDocument();
    }
  });

  it('vende escolhendo recipiente e aroma, e confirma com o estoque novo', async () => {
    const user = userEvent.setup();
    renderApp();

    await sellFoscoLavanda(user, '2');

    expect(await screen.findByRole('heading', { name: 'Venda registrada' })).toBeInTheDocument();
    expect(
      screen.getByText(/2× Lavanda · Recipiente Fosco 200g · R\$\s131,80/),
    ).toBeInTheDocument();
    expect(screen.getByText('Agora tem 3 un. dessa vela.')).toBeInTheDocument();
  });

  it('"Registrar outra venda" volta para os aromas do mesmo recipiente', async () => {
    const user = userEvent.setup();
    renderApp();

    await sellFoscoLavanda(user, '1');
    await user.click(await screen.findByRole('button', { name: 'Registrar outra venda' }));

    expect(screen.getByText('Qual aroma?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recipiente Fosco 200g' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lavanda.*4 un\./ })).toBeInTheDocument();
  });

  it('desfaz o lançamento na confirmação e devolve o estoque', async () => {
    const user = userEvent.setup();
    renderApp();

    await sellFoscoLavanda(user, '2');
    await user.click(await screen.findByRole('button', { name: 'Desfazer este lançamento' }));

    expect(await screen.findByRole('heading', { name: 'Venda desfeita' })).toBeInTheDocument();
    expect(screen.getByText('Agora tem 5 un. dessa vela.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Desfazer este lançamento' }),
    ).not.toBeInTheDocument();
  });

  it('em Vender, vela sem estoque aparece mas não pode ser escolhida', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Vender/ }));
    await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));

    expect(screen.getByRole('button', { name: /Santal/ })).toBeDisabled();
    expect(screen.getByText('Sem estoque para vender')).toBeInTheDocument();
  });

  it('a busca pula a escolha do recipiente', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Vender/ }));
    await user.type(screen.getByLabelText('Buscar vela'), 'fosco cafe');

    const rows = screen.getAllByRole('button', { name: /Café/ });
    expect(rows).toHaveLength(1);
    await user.click(rows[0]);
    expect(screen.getByLabelText('Quantidade vendida')).toBeInTheDocument();
  });

  it('em Produzir, avisa na lista e no formulário quando falta insumo', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Produzir/ }));
    await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));
    expect(screen.getByText('Falta essência lavanda')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Lavanda/ }));
    await user.click(screen.getByRole('button', { name: 'Registrar produção' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Essência Lavanda: faltam 5 g');
  });

  it('registra entrada de insumo', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Entrada de insumo/ }));
    await user.click(screen.getByRole('button', { name: /Cera de coco/ }));
    await user.clear(screen.getByLabelText('Quantidade comprada (g)'));
    await user.type(screen.getByLabelText('Quantidade comprada (g)'), '500');
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }));

    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(screen.getByText('Agora tem 1.500 g de cera de coco.')).toBeInTheDocument();
  });

  it('registra o valor pago na entrada e mostra o custo por kg', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Entrada de insumo/ }));
    await user.click(screen.getByRole('button', { name: /Cera de coco/ }));
    await user.clear(screen.getByLabelText('Quantidade comprada (g)'));
    await user.type(screen.getByLabelText('Quantidade comprada (g)'), '2000');
    await user.type(screen.getByLabelText('Valor pago (R$, opcional)'), '360,00');

    expect(screen.getByText('Sai a R$ 180,00 por kg.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Registrar compra' }));

    expect(await screen.findByRole('heading', { name: 'Entrada registrada' })).toBeInTheDocument();
    expect(screen.getByText(/R\$\s360,00/)).toBeInTheDocument();
  });

  it('recusa valor pago que não é número', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Entrada de insumo/ }));
    await user.click(screen.getByRole('button', { name: /Cera de coco/ }));
    await user.clear(screen.getByLabelText('Quantidade comprada (g)'));
    await user.type(screen.getByLabelText('Quantidade comprada (g)'), '500');
    await user.type(screen.getByLabelText('Valor pago (R$, opcional)'), 'cento e oitenta');
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Valor pago inválido');
    expect(screen.queryByRole('heading', { name: 'Entrada registrada' })).not.toBeInTheDocument();
  });

  it('o aviso de estoque baixo leva para o Estoque', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /com estoque baixo/ }));

    expect(screen.getByRole('heading', { name: 'Estoque' })).toBeInTheDocument();
  });
});

describe('Estoque: consulta e cadastro', () => {
  async function openStock(user: ReturnType<typeof userEvent.setup>) {
    const nav = screen.getAllByRole('button', { name: /Estoque/ })[0];
    await user.click(nav);
  }

  it('mostra os recipientes com resumo, e entra para ver os aromas sem botões de ação', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'O que você vai lançar?' });
    await openStock(user);

    const liso = screen.getByRole('button', { name: /Clássica Liso 90g/ });
    expect(liso).toHaveTextContent('R$ 35,90 · 2 aromas');
    expect(liso).toHaveTextContent('1 com estoque baixo');

    await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Recipiente Fosco 200g' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vender' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '‹ Recipientes' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Estoque' })).toBeInTheDocument();
  });

  it('tocar num aroma abre os detalhes com a ficha técnica e o Editar', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'O que você vai lançar?' });
    await openStock(user);

    await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));
    await user.click(screen.getByRole('button', { name: /Lavanda/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Lavanda' });
    expect(within(dialog).getByText('180 g Cera de coco')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Editar vela' }));
    expect(await screen.findByRole('dialog', { name: 'Editar vela' })).toBeInTheDocument();
  });

  it('"+ Novo aroma" já vem com o recipiente e o preço dele', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'O que você vai lançar?' });
    await openStock(user);

    await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));
    await user.click(screen.getByRole('button', { name: '+ Novo aroma' }));

    const dialog = await screen.findByRole('dialog', { name: 'Nova vela' });
    expect(within(dialog).getByLabelText('Modelo')).toHaveValue('Recipiente Fosco 200g');
    expect(within(dialog).getByLabelText('Preço (R$)')).toHaveValue(65.9);
  });

  it('cadastra uma vela nova e abre o recipiente dela', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'O que você vai lançar?' });
    await openStock(user);

    await user.click(screen.getByRole('button', { name: '+ Nova vela' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova vela' });
    await user.type(within(dialog).getByLabelText('Modelo'), 'Recipiente Refinado 200g');
    await user.type(within(dialog).getByLabelText('Aroma'), 'Canela');
    await user.clear(within(dialog).getByLabelText('Preço (R$)'));
    await user.type(within(dialog).getByLabelText('Preço (R$)'), '75.90');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Recipiente Refinado 200g' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Canela/ })).toBeInTheDocument();
  });

  it('lista insumos com o que está abaixo do mínimo primeiro, e busca', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'O que você vai lançar?' });
    await openStock(user);

    await user.click(screen.getByRole('tab', { name: 'Insumos' }));
    const rows = screen.getAllByRole('button', {
      name: /Cera de coco|Essência Lavanda|Frasco 200g fosco/,
    });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Essência Lavanda'),
      expect.stringContaining('Cera de coco'),
      expect.stringContaining('Frasco 200g fosco'),
    ]);
    expect(rows[0]).toHaveTextContent('Abaixo do mínimo (30 g)');

    await user.type(screen.getByLabelText('Buscar insumo'), 'frasco');
    expect(screen.getByRole('button', { name: /Frasco 200g fosco/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cera de coco/ })).not.toBeInTheDocument();
  });
});
