import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../App';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import type { Product, Recipe, Supply } from '../../domain/models';
import type { RegisterProductionResult } from '../../application/registerProduction';
import { failureMessage } from '../failureMessage';

const CREATED_AT = '2026-09-11T00:00:00.000Z';

/** Erro do Supabase: objeto com message e code, não uma instância de Error. */
const rpcError = { message: 'permission denied for table supplies', code: '42501' };

/**
 * Em produção o "Registrar produção" não fazia nada: a falha do banco subia como
 * promessa rejeitada e a tela continuava igual. Agora a tela precisa dizer algo.
 */
class RepositorioQueFalha extends InMemoryRepository {
  async registerProduction(): Promise<RegisterProductionResult> {
    throw rpcError;
  }
}

function renderApp() {
  const recipes: Recipe[] = [
    { id: 'r1', name: 'Fosco Lavanda', items: [{ supplyId: 's-cera', quantityPerUnit: 180 }] },
  ];
  const product: Product = {
    id: 'p1',
    model: 'Recipiente Fosco 200g',
    scent: 'Lavanda',
    priceCents: 6590,
    quantity: 2,
    minQuantity: 0,
    active: true,
    createdAt: CREATED_AT,
    recipeId: 'r1',
  };
  const supplies: Supply[] = [
    {
      id: 's-cera',
      name: 'Cera de coco',
      unit: 'g',
      quantity: 5000,
      minQuantity: 0,
      createdAt: CREATED_AT,
    },
  ];
  render(
    <AppShell repository={new RepositorioQueFalha({ products: [product], supplies, recipes })} />,
  );
}

describe('falha inesperada ao lançar', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra o erro na tela em vez de não fazer nada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole('button', { name: /Produzir/ }));
    await user.click(screen.getByRole('button', { name: /Recipiente Fosco 200g/ }));
    await user.click(screen.getByRole('button', { name: /Lavanda/ }));
    await user.click(screen.getByRole('button', { name: 'Registrar produção' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Não foi possível concluir');
    expect(aviso.textContent).toContain('permission denied for table supplies');
    expect(aviso.textContent).toContain('42501');
  });
});

describe('failureMessage', () => {
  it('traduz sessão vencida em vez de mostrar o erro cru', () => {
    expect(failureMessage({ message: 'JWT expired', code: 'PGRST301' })).toBe(
      'Sua sessão expirou. Feche e abra o app de novo e, se pedir, faça o login outra vez.',
    );
  });

  it('junta mensagem e código do Supabase', () => {
    expect(failureMessage({ message: 'permission denied', code: '42501' })).toContain(
      'permission denied · código 42501',
    );
  });

  it('não deixa a falha sem texto', () => {
    expect(failureMessage(undefined)).toContain('erro sem descrição');
  });
});
