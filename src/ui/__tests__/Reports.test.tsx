import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell, type SaveWorkbook } from '../../App';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import type { Movement, Product, Supply } from '../../domain/models';

const CREATED_AT = '2026-01-01T00:00:00.000Z';
const today = new Date();
/** Hoje, numa hora fixa, no fuso local: sempre dentro de "Este mês". */
const thisMonth = (hour: number) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour).toISOString();
const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15, 12).toISOString();

const product = (id: string, model: string, scent: string, priceCents: number): Product => ({
  id,
  model,
  scent,
  priceCents,
  quantity: 5,
  minQuantity: 0,
  active: true,
  createdAt: CREATED_AT,
});
const supply = (id: string, name: string, unit: Supply['unit']): Supply => ({
  id,
  name,
  unit,
  quantity: 100,
  minQuantity: 0,
  createdAt: CREATED_AT,
});
let seq = 0;
const movement = (fields: Omit<Movement, 'id' | 'undone'>): Movement => ({
  id: `m${++seq}`,
  undone: false,
  ...fields,
});

function renderReports(saveWorkbook: SaveWorkbook = vi.fn().mockResolvedValue(undefined)) {
  const repository = new InMemoryRepository({
    products: [
      product('fosco-lav', 'Recipiente Fosco 200g', 'Lavanda', 6590),
      product('liso-cafe', 'Clássica Liso 90g', 'Café', 3590),
    ],
    supplies: [
      supply('cera', 'Cera de coco', 'g'),
      supply('ess-lav', 'Essência Lavanda', 'g'),
      supply('frasco', 'Frasco 200g fosco', 'un'),
    ],
    movements: [
      movement({
        type: 'sale',
        productId: 'fosco-lav',
        quantity: 2,
        totalCents: 13180,
        occurredAt: thisMonth(10),
      }),
      movement({
        type: 'sale',
        productId: 'liso-cafe',
        quantity: 1,
        totalCents: 3590,
        occurredAt: thisMonth(11),
      }),
      movement({
        type: 'sale',
        productId: 'liso-cafe',
        quantity: 3,
        totalCents: 10770,
        occurredAt: lastMonth,
      }),
      movement({
        type: 'supply_purchase',
        supplyId: 'cera',
        quantity: 2000,
        totalCents: 12000,
        occurredAt: thisMonth(9),
      }),
      movement({
        type: 'supply_purchase',
        supplyId: 'ess-lav',
        quantity: 100,
        totalCents: 4000,
        occurredAt: thisMonth(9),
      }),
      movement({
        type: 'supply_purchase',
        supplyId: 'frasco',
        quantity: 10,
        occurredAt: thisMonth(9),
      }),
      movement({
        type: 'adjustment',
        productId: 'fosco-lav',
        quantity: -1,
        note: 'Brinde',
        occurredAt: thisMonth(12),
      }),
    ],
  });
  render(<AppShell repository={repository} saveWorkbook={saveWorkbook} />);
  return repository;
}

async function openReports(user: ReturnType<typeof userEvent.setup>) {
  await user.click((await screen.findAllByRole('button', { name: /Relatório/ }))[0]);
  await screen.findByRole('heading', { name: 'Relatórios' });
}

describe('Relatórios', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra quanto entrou, saiu e sobrou no mês, e os cinco relatórios', async () => {
    const user = userEvent.setup();
    renderReports();
    await openReports(user);

    const overview = screen.getByRole('button', { name: /Visão geral/ });
    expect(within(overview).getByText('Entrou').nextSibling).toHaveTextContent('R$ 167,70');
    expect(within(overview).getByText('Saiu').nextSibling).toHaveTextContent('R$ 160,00');
    expect(within(overview).getByText('Sobrou').nextSibling).toHaveTextContent('R$ 7,70');

    for (const name of ['Vendas', 'Produção', 'Saídas de estoque', 'Gastos', 'Histórico']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
  });

  it('trocar o período recalcula tudo', async () => {
    const user = userEvent.setup();
    renderReports();
    await openReports(user);

    await user.click(screen.getByRole('button', { name: 'Mês passado' }));

    const overview = screen.getByRole('button', { name: /Visão geral/ });
    expect(within(overview).getByText('Entrou').nextSibling).toHaveTextContent('R$ 107,70');
    expect(within(overview).getByText('Saiu').nextSibling).toHaveTextContent('R$ 0,00');
  });

  it('Vendas compara com o período anterior e mostra as últimas vendas', async () => {
    const user = userEvent.setup();
    renderReports();
    await openReports(user);
    await user.click(screen.getByRole('button', { name: /^Vendas/ }));

    expect(screen.getByRole('heading', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.getByText('2× Lavanda')).toBeInTheDocument();
    expect(screen.getByText('1× Café')).toBeInTheDocument();
    // O valor da comparação depende do dia de hoje (a venda de referência é do dia
    // 15 do mês passado); aqui só se confere que ela aparece.
    expect(
      screen.getAllByText(/vs anterior|sem período anterior|igual ao período anterior/).length,
    ).toBeGreaterThan(0);
  });

  it('Gastos: avisa entrada sem valor e filtra por categoria e por busca', async () => {
    const user = userEvent.setup();
    renderReports();
    await openReports(user);
    await user.click(screen.getByRole('button', { name: /^Gastos/ }));

    expect(screen.getByText(/1 entrada sem valor pago não está somada aqui/)).toBeInTheDocument();
    expect(screen.getByText('Cera de coco')).toBeInTheDocument();
    expect(screen.getByText('Essência Lavanda')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Essências/ }));
    expect(screen.getByRole('heading', { name: 'Gasto com Essências' })).toBeInTheDocument();
    expect(screen.queryByText('Cera de coco')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver todos os insumos' }));
    await user.type(screen.getByLabelText('Quanto gastei com…'), 'cera');
    expect(screen.getByText('Cera de coco')).toBeInTheDocument();
    expect(screen.queryByText('Essência Lavanda')).not.toBeInTheDocument();
    expect(screen.getByText(/R\$ 60,00 por kg/)).toBeInTheDocument();
  });

  it('Saídas de estoque separa as vendidas dos brindes', async () => {
    const user = userEvent.setup();
    renderReports();
    await openReports(user);
    await user.click(screen.getByRole('button', { name: /^Saídas de estoque/ }));

    expect(screen.getByText('Vendidas')).toBeInTheDocument();
    expect(screen.getByText('Brinde')).toBeInTheDocument();
    expect(screen.getByText('Brinde · Lavanda · Recipiente Fosco 200g')).toBeInTheDocument();
  });

  it('Histórico desfaz um lançamento e ele sai da lista', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const repository = renderReports();
    await openReports(user);
    await user.click(screen.getByRole('button', { name: /^Histórico/ }));

    const brinde = screen.getByText(/Ajuste · −1 Lavanda/).closest('li')!;
    await user.click(within(brinde).getByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText(/Venda · 2× Lavanda/)).toBeInTheDocument();
    expect(screen.queryByText(/Ajuste · −1 Lavanda/)).not.toBeInTheDocument();
    expect((await repository.listProducts()).find((p) => p.id === 'fosco-lav')!.quantity).toBe(6);
  });

  it('baixa o relatório completo em Excel, com o período no nome do arquivo', async () => {
    const user = userEvent.setup();
    const saveWorkbook = vi.fn<SaveWorkbook>().mockResolvedValue(undefined);
    renderReports(saveWorkbook);
    await openReports(user);

    await user.click(screen.getByRole('button', { name: /Baixar relatório completo \(Excel\)/ }));

    expect(saveWorkbook).toHaveBeenCalledTimes(1);
    const model = saveWorkbook.mock.calls[0][0];
    expect(model.fileName).toMatch(
      /^laurea-relatorio-completo-\d{4}-\d{2}-01-a-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(model.sheets.map((s) => s.name)).toContain('Estoque de insumos');
    expect(model.sheets.find((s) => s.name === 'Vendas')!.rows).toHaveLength(2);
  });

  it('dentro de um relatório, exporta só as abas dele e respeita o período escolhido', async () => {
    const user = userEvent.setup();
    const saveWorkbook = vi.fn<SaveWorkbook>().mockResolvedValue(undefined);
    renderReports(saveWorkbook);
    await openReports(user);
    await user.click(screen.getByRole('button', { name: /^Vendas/ }));
    await user.click(screen.getByRole('button', { name: 'Mês passado' }));

    await user.click(screen.getByRole('button', { name: /Exportar para Excel/ }));

    const model = saveWorkbook.mock.calls[0][0];
    expect(model.fileName).toMatch(/^laurea-vendas-\d{4}-\d{2}\.xlsx$/);
    expect(model.sheets.map((s) => s.name)).toEqual(['Resumo', 'Vendas', 'Por vela']);
    expect(model.sheets[1].rows).toHaveLength(1); // só a venda do mês passado
  });

  it('avisa quando não consegue gerar a planilha', async () => {
    const user = userEvent.setup();
    renderReports(vi.fn<SaveWorkbook>().mockRejectedValue(new Error('falhou')));
    await openReports(user);

    await user.click(screen.getByRole('button', { name: /Baixar relatório completo \(Excel\)/ }));

    expect(
      await screen.findByText('Não foi possível gerar a planilha. Tente de novo.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Baixar relatório completo \(Excel\)/ }),
    ).toBeEnabled();
  });
});
