export type Screen = 'home' | 'stock' | 'report' | 'backup';

const ITEMS: { id: Screen; label: string; icon: string }[] = [
  { id: 'home', label: 'Início', icon: '🕯️' },
  { id: 'stock', label: 'Estoque', icon: '📦' },
  { id: 'report', label: 'Relatório', icon: '📋' },
  { id: 'backup', label: 'Backup', icon: '💾' },
];

type NavProps = {
  current: Screen;
  onChange: (screen: Screen) => void;
  onSignOut?: () => void;
};

export function Nav({ current, onChange, onSignOut }: NavProps) {
  return (
    <nav aria-label="Navegação principal">
      {/* Mobile: abas fixas na base */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex border-t border-taupe/20 bg-paper lg:hidden">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={current === item.id ? 'page' : undefined}
            onClick={() => onChange(item.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              current === item.id ? 'text-gold' : 'text-taupe'
            }`}
          >
            <span aria-hidden="true" className="text-lg">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Desktop: navegação lateral fixa */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-taupe/20 lg:bg-paper lg:p-4">
        <p className="mb-6 px-2 font-display text-2xl font-semibold text-ink">L&apos;AUREA</p>
        <ul className="flex flex-col gap-1">
          {ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={current === item.id ? 'page' : undefined}
                onClick={() => onChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left font-medium ${
                  current === item.id ? 'bg-gold/10 text-gold' : 'text-taupe hover:bg-cream'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-auto rounded-md px-3 py-2 text-left text-sm font-medium text-taupe hover:bg-cream"
          >
            Sair
          </button>
        )}
      </div>
    </nav>
  );
}
