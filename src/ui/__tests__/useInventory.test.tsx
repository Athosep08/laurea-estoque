import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useInventory } from '../hooks/useInventory';
import { InMemoryRepository } from '../../infra/storage/InMemoryRepository';
import type { Product } from '../../domain/models';

const vela: Product = {
  id: 'p1',
  model: 'Recipiente Fosco 200g',
  scent: 'Lavanda',
  priceCents: 6590,
  quantity: 5,
  minQuantity: 0,
  active: true,
  createdAt: '2026-09-01T00:00:00.000Z',
};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('useInventory com dois aparelhos', () => {
  afterEach(() => setVisibility('visible'));

  it('ao voltar para a tela, mostra o que o outro celular lançou', async () => {
    const repository = new InMemoryRepository({ products: [vela] });
    const { result } = renderHook(() => useInventory(repository));
    await waitFor(() => expect(result.current.products[0]?.quantity).toBe(5));

    // O "outro celular" vende 2 direto no banco, e este app está em segundo plano.
    setVisibility('hidden');
    await repository.registerSale({ productId: 'p1', quantity: 2 });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(result.current.products[0].quantity).toBe(5);

    // Voltou para a tela: recarrega.
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.products[0].quantity).toBe(3));
  });

  it('recarrega quando a conexão volta', async () => {
    const repository = new InMemoryRepository({ products: [vela] });
    const { result } = renderHook(() => useInventory(repository));
    await waitFor(() => expect(result.current.products[0]?.quantity).toBe(5));

    await repository.registerSale({ productId: 'p1', quantity: 1 });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.products[0].quantity).toBe(4));
  });
});
