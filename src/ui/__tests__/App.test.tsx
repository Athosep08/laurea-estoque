import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';

async function createProduct(options: {
  model: string;
  scent: string;
  price: string;
  quantity: string;
  minQuantity: string;
}) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '+ Nova vela' }));

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
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('cadastra uma vela e registra uma venda, debitando o estoque', async () => {
    const user = userEvent.setup();
    render(<App />);

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
    render(<App />);

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
