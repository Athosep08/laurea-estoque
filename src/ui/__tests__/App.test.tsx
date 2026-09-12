import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../App';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';

async function createProduct(options: {
  model: string;
  scent: string;
  price: string;
  quantity: string;
  minQuantity: string;
}) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '+ Nova vela' }));

  const dialog = await screen.findByRole('dialog', { name: 'Nova vela' });
  await user.type(within(dialog).getByLabelText('Modelo'), options.model);
  await user.type(within(dialog).getByLabelText('Aroma'), options.scent);
  await user.clear(within(dialog).getByLabelText('Preço (R$)'));
  await user.type(within(dialog).getByLabelText('Preço (R$)'), options.price);
  await user.clear(within(dialog).getByLabelText('Quantidade inicial'));
  await user.type(within(dialog).getByLabelText('Quantidade inicial'), options.quantity);
  await user.clear(within(dialog).getByLabelText('Estoque mínimo (alerta)'));
  await user.type(within(dialog).getByLabelText('Estoque mínimo (alerta)'), options.minQuantity);
  await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
}

describe('fluxo de venda na tela de Velas', () => {
  it('cadastra uma vela e registra uma venda, debitando o estoque', async () => {
    const user = userEvent.setup();
    render(<AppShell repository={new InMemoryRepository()} onSignOut={() => {}} />);

    await createProduct({
      model: 'Clássica Liso 90g',
      scent: 'Lavanda',
      price: '35.90',
      quantity: '5',
      minQuantity: '2',
    });

    const card = (await screen.findByText('Lavanda')).closest('article')!;
    expect(within(card).getByText('5')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Vender' }));
    const sellDialog = await screen.findByRole('dialog', { name: 'Registrar venda' });
    await user.clear(within(sellDialog).getByLabelText('Quantidade vendida'));
    await user.type(within(sellDialog).getByLabelText('Quantidade vendida'), '2');
    await user.click(within(sellDialog).getByRole('button', { name: 'Registrar venda' }));

    const updatedCard = (await screen.findByText('Lavanda')).closest('article')!;
    expect(within(updatedCard).getByText('3')).toBeInTheDocument();
  });

  it('mostra o alerta de estoque baixo quando a quantidade atinge o mínimo', async () => {
    render(<AppShell repository={new InMemoryRepository()} onSignOut={() => {}} />);

    await createProduct({
      model: 'Recipiente Fosco 200g',
      scent: 'Café',
      price: '65.90',
      quantity: '1',
      minQuantity: '3',
    });

    const card = (await screen.findByText('Café')).closest('article')!;
    expect(within(card).getByText('Estoque baixo')).toBeInTheDocument();
  });
});

describe('busca na tela de Velas', () => {
  function renderWithCatalog() {
    const product = (id: string, model: string, scent: string) => ({
      id,
      model,
      scent,
      priceCents: 3590,
      quantity: 5,
      minQuantity: 0,
      active: true,
      createdAt: '2026-09-11T00:00:00.000Z',
    });
    const repository = new InMemoryRepository({
      products: [
        product('p1', 'Clássica Liso 90g', 'Café'),
        product('p2', 'Clássica Liso 90g', 'Lavanda'),
        product('p3', 'Recipiente Fosco 200g', 'Café'),
        product('p4', 'Recipiente Fosco 200g', 'Flor de Figo'),
      ],
    });
    render(<AppShell repository={repository} onSignOut={() => {}} />);
  }

  it('filtra por aroma ignorando acento e maiúsculas', async () => {
    const user = userEvent.setup();
    renderWithCatalog();

    await user.type(await screen.findByLabelText('Buscar vela'), 'CAFE');

    expect(screen.getAllByText('Café')).toHaveLength(2);
    expect(screen.queryByText('Lavanda')).not.toBeInTheDocument();
    expect(screen.queryByText('Flor de Figo')).not.toBeInTheDocument();
  });

  it('filtra por modelo e esconde os grupos sem resultado', async () => {
    const user = userEvent.setup();
    renderWithCatalog();

    await user.type(await screen.findByLabelText('Buscar vela'), 'fosco');

    expect(screen.getByRole('heading', { name: 'Recipiente Fosco 200g' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Clássica Liso 90g' })).not.toBeInTheDocument();
    expect(screen.getByText('Flor de Figo')).toBeInTheDocument();
  });

  it('combina aroma e modelo em qualquer ordem', async () => {
    const user = userEvent.setup();
    renderWithCatalog();

    await user.type(await screen.findByLabelText('Buscar vela'), 'fosco cafe');

    expect(screen.getAllByText('Café')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Recipiente Fosco 200g' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Clássica Liso 90g' })).not.toBeInTheDocument();
  });

  it('avisa quando nenhuma vela corresponde à busca', async () => {
    const user = userEvent.setup();
    renderWithCatalog();

    await user.type(await screen.findByLabelText('Buscar vela'), 'santal');

    expect(screen.getByText('Nenhuma vela encontrada para “santal”.')).toBeInTheDocument();
  });
});
