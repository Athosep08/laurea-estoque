import { useState } from 'react';
import { Nav, type Screen } from './ui/components/Nav';
import { useRepository } from './ui/hooks/useRepository';
import { useInventory } from './ui/hooks/useInventory';
import { ProductsScreen } from './ui/screens/ProductsScreen';
import { SuppliesScreen } from './ui/screens/SuppliesScreen';
import { ReportScreen } from './ui/screens/ReportScreen';
import { BackupScreen } from './ui/screens/BackupScreen';

export default function App() {
  const [screen, setScreen] = useState<Screen>('products');
  const repository = useRepository();
  const inventory = useInventory(repository);

  return (
    <div className="min-h-screen bg-cream">
      <Nav current={screen} onChange={setScreen} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 lg:ml-60 lg:pb-6">
        {screen === 'products' && <ProductsScreen inventory={inventory} />}
        {screen === 'supplies' && <SuppliesScreen inventory={inventory} />}
        {screen === 'report' && <ReportScreen inventory={inventory} />}
        {screen === 'backup' && <BackupScreen repository={repository} inventory={inventory} />}
      </main>
    </div>
  );
}
