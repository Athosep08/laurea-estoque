import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Nav, type Screen } from './ui/components/Nav';
import { useAuth } from './ui/hooks/useAuth';
import { useOnlineStatus } from './ui/hooks/useOnlineStatus';
import { useRepository } from './ui/hooks/useRepository';
import { useInventory } from './ui/hooks/useInventory';
import type { EstoqueRepository } from './infra/storage/EstoqueRepository';
import { LocalStorageRepository } from './infra/storage/LocalStorageRepository';
import { createDemoState } from './infra/storage/demoSeed';
import { workbookToBlob } from './infra/export/xlsxWorkbook';
import type { WorkbookModel } from './application/reportWorkbook';
import { saveBlob } from './ui/saveFile';
import { LoginScreen } from './ui/screens/LoginScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { StockScreen } from './ui/screens/StockScreen';
import { ReportScreen } from './ui/screens/ReportScreen';
import { BackupScreen } from './ui/screens/BackupScreen';

/** `npm run dev:demo` liga isto (ver `.env.demo`). Nunca vale no build de produção. */
const DEMO_MODE = import.meta.env.VITE_DEMO === 'true';

export default function App() {
  return DEMO_MODE ? <DemoApp /> : <SupabaseApp />;
}

function SupabaseApp() {
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

/**
 * Modo demonstração: sem login e sem Supabase. Os dados ficam no
 * localStorage deste navegador e começam com a carga inicial do seed.
 */
function DemoApp() {
  const repository = useMemo(() => new LocalStorageRepository(), []);
  const [session, setSession] = useState(0);

  useEffect(() => {
    let cancelled = false;
    repository.listProducts().then(async (products) => {
      if (products.length === 0) await repository.replaceState(createDemoState());
      if (!cancelled) setSession(1);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  async function restart() {
    if (!window.confirm('Apagar tudo o que foi lançado na demonstração e começar de novo?')) return;
    await repository.replaceState(createDemoState());
    setSession((s) => s + 1);
  }

  if (session === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-taupe">Preparando a demonstração...</p>
      </div>
    );
  }

  return (
    <AppShell
      key={session}
      repository={repository}
      banner={
        <p className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-gold/10 p-3 text-sm text-gold">
          <span>
            Modo demonstração: os dados ficam só neste navegador, e parte dos estoques é de exemplo.
          </span>
          <button type="button" onClick={restart} className="font-semibold underline">
            Recomeçar
          </button>
        </p>
      }
    />
  );
}

/**
 * Largura do conteúdo por tela. Listas e formulários ficam numa coluna de
 * leitura (linha muito larga afasta o nome da quantidade); o relatório, com
 * tabelas, usa mais espaço.
 */
const WIDTH: Record<Screen, string> = {
  home: 'max-w-4xl',
  stock: 'max-w-4xl',
  report: 'max-w-6xl',
  backup: 'max-w-4xl',
};

/** Gera o .xlsx e entrega no aparelho. Os testes passam uma versão falsa. */
export type SaveWorkbook = (model: WorkbookModel) => Promise<void>;

const saveWorkbookAsXlsx: SaveWorkbook = async (model) => {
  await saveBlob(await workbookToBlob(model), model.fileName);
};

type AppShellProps = {
  repository: EstoqueRepository;
  onSignOut?: () => void;
  banner?: ReactNode;
  saveWorkbook?: SaveWorkbook;
};

/**
 * Recebe o repositório já pronto — não sabe (nem precisa saber) se é o
 * adapter do Supabase ou um fake em memória. Isso mantém a UI testável
 * contra a porta `EstoqueRepository`, do mesmo jeito que `application/` já
 * é testado com `InMemoryRepository` em vez do adapter real.
 */
export function AppShell({
  repository,
  onSignOut,
  banner,
  saveWorkbook = saveWorkbookAsXlsx,
}: AppShellProps) {
  const [screen, setScreen] = useState<Screen>('home');
  // Tocar em "Início" estando no meio de um lançamento volta para os quadrados.
  const [homeKey, setHomeKey] = useState(0);
  const inventory = useInventory(repository);
  const isOnline = useOnlineStatus();

  function navigate(next: Screen) {
    if (next === 'home') setHomeKey((k) => k + 1);
    setScreen(next);
  }

  return (
    <div className="min-h-screen bg-cream">
      <Nav current={screen} onChange={navigate} onSignOut={onSignOut} />
      {/* A barra lateral (w-60) vira padding; o conteúdo centraliza no espaço que sobra. */}
      <main className="px-4 pb-24 pt-6 lg:pb-8 lg:pl-60 lg:pr-0">
        <div className={`mx-auto w-full lg:px-8 ${WIDTH[screen]}`}>
          {banner}
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
              {screen === 'home' && (
                <HomeScreen
                  key={homeKey}
                  inventory={inventory}
                  isOnline={isOnline}
                  onOpenStock={() => navigate('stock')}
                />
              )}
              {screen === 'stock' && <StockScreen inventory={inventory} isOnline={isOnline} />}
              {screen === 'report' && (
                <ReportScreen inventory={inventory} isOnline={isOnline} onExport={saveWorkbook} />
              )}
              {screen === 'backup' && (
                <BackupScreen repository={repository} inventory={inventory} isOnline={isOnline} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
