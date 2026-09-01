import { useState } from 'react';
import { Nav, type Screen } from './ui/components/Nav';
import { useAuth } from './ui/hooks/useAuth';
import { useOnlineStatus } from './ui/hooks/useOnlineStatus';
import { useRepository } from './ui/hooks/useRepository';
import { useInventory } from './ui/hooks/useInventory';
import type { EstoqueRepository } from './infra/storage/EstoqueRepository';
import { LoginScreen } from './ui/screens/LoginScreen';
import { ProductsScreen } from './ui/screens/ProductsScreen';
import { SuppliesScreen } from './ui/screens/SuppliesScreen';
import { ReportScreen } from './ui/screens/ReportScreen';
import { BackupScreen } from './ui/screens/BackupScreen';

export default function App() {
  const { session, loading: authLoading, signIn, signOut } = useAuth();
  const repository = useRepository();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-taupe">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSubmit={signIn} />;
  }

  return <AppShell repository={repository} onSignOut={signOut} />;
}

type AppShellProps = {
  repository: EstoqueRepository;
  onSignOut: () => void;
};

/**
 * Recebe o repositório já pronto — não sabe (nem precisa saber) se é o
 * adapter do Supabase ou um fake em memória. Isso mantém a UI testável
 * contra a porta `EstoqueRepository`, do mesmo jeito que `application/` já
 * é testado com `InMemoryRepository` em vez do adapter real.
 */
export function AppShell({ repository, onSignOut }: AppShellProps) {
  const [screen, setScreen] = useState<Screen>('products');
  const inventory = useInventory(repository);
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen bg-cream">
      <Nav current={screen} onChange={setScreen} onSignOut={onSignOut} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 lg:ml-60 lg:pb-6">
        {!isOnline && (
          <p className="mb-4 rounded-md bg-gold/10 p-3 text-sm text-gold">
            Modo offline — somente leitura. Vendas, produções, compras e ajustes exigem conexão.
          </p>
        )}
        {inventory.error && (
          <p role="alert" className="mb-4 rounded-md bg-alert/10 p-3 text-sm text-alert">
            {inventory.error}
          </p>
        )}
        {inventory.loading ? (
          <p className="text-taupe">Carregando dados...</p>
        ) : (
          <>
            {screen === 'products' && <ProductsScreen inventory={inventory} isOnline={isOnline} />}
            {screen === 'supplies' && <SuppliesScreen inventory={inventory} isOnline={isOnline} />}
            {screen === 'report' && <ReportScreen inventory={inventory} isOnline={isOnline} />}
            {screen === 'backup' && (
              <BackupScreen repository={repository} inventory={inventory} isOnline={isOnline} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
