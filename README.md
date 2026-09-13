# L'AUREA Estoque

PWA de controle de estoque para a L'AUREA Aromas (velas artesanais, Chapecó/SC). Cadastro de velas e insumos, produção com baixa automática de receita, registro de vendas, ajustes de estoque com justificativa, relatório mensal e backup/restauração — com um backend real (Supabase/Postgres) para uso simultâneo em N dispositivos, login compartilhado e modo offline somente leitura.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript (`strict`)
- [Supabase](https://supabase.com/) (Postgres + Auth + API) como backend
- [Tailwind CSS](https://tailwindcss.com/) para estilo
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) para testes
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) para instalação/offline
- ESLint + Prettier para qualidade e formatação
- GitHub Actions para CI (lint → typecheck → test → build)

## Configurando o Supabase (uma vez, por instância do projeto)

1. Crie um projeto em [supabase.com](https://supabase.com/). Na tela de criação, mantenha **"Enable Data API"** marcado, **desmarque "Automatically expose new tables"** e **marque "Enable automatic RLS"**.
2. Abra o **SQL Editor** do projeto, cole o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e rode. Isso cria as tabelas, RLS, grants e as funções RPC que fazem as mutações de estoque de forma atômica (ver "Decisões de arquitetura" abaixo).
3. Ainda no **SQL Editor**, rode [`supabase/migrations/0002_carga_inicial.sql`](supabase/migrations/0002_carga_inicial.sql). Isso cadastra os 24 insumos reais (cera de coco, as 14 essências, pavio, ilhós, os três frascos, adesivos, sacola e caixa) e os 42 produtos (3 modelos × 14 aromas), cada um com a sua ficha técnica. Os IDs são determinísticos, então rodar duas vezes não duplica nada. Nomes e preços dos modelos vêm da landing page; se mudarem, ajuste no topo do arquivo antes de rodar — o script aborta sem gravar nada se algum preço estiver zerado.
4. Vá em **Authentication → Users → Add user**, crie o e-mail/senha compartilhado que os dois dispositivos vão usar para logar, e marque **"Auto Confirm User"**.
5. Em **Settings (ícone de engrenagem) → API**, copie a **Project URL** e a chave **`anon` `public`** (nunca a `service_role`).
6. Copie `.env.example` para `.env.local` e preencha:
   ```
   VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
   VITE_SUPABASE_ANON_KEY=<sua-chave-anon>
   ```
   `.env.local` não é versionado.

## Rodando localmente

```bash
npm install
npm run dev        # ambiente de desenvolvimento
npm run build      # build de produção (dist/)
npm test           # suíte de testes (Vitest)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier (grava)
```

### Modo demonstração (sem Supabase)

```bash
npm run dev:demo
```

Abre o app sem login e sem tocar no banco. Os dados ficam no `localStorage` do navegador e começam com a mesma carga inicial do seed (receitas, preços, cera e essências reais), completada com estoques de exemplo onde o stakeholder ainda não respondeu. O botão **Recomeçar**, na faixa do topo, volta tudo ao estado inicial. A configuração está em [`.env.demo`](.env.demo); o `npm run dev` normal continua usando o Supabase.

## Decisões de arquitetura

O projeto segue **arquitetura hexagonal (ports & adapters)**, organizada em quatro camadas com fronteiras estritas:

```
src/
  domain/        regras de negócio puras — zero I/O, zero React, zero Date() direto
  application/   casos de uso — hoje são delegadores finos para o repositório (ver abaixo)
  infra/         adaptadores — SupabaseEstoqueRepository (produção), LocalStorageRepository/InMemoryRepository (fallback local e testes)
  ui/            componentes React — nunca chamam o repositório diretamente
supabase/
  migrations/    schema SQL, RLS e funções RPC — fonte da verdade do backend
```

**Por que essa separação.** O domínio (`domain/`) contém funções puras (`sell`, `produce`, `adjustProductQuantity`, `getMonthlyReport`, etc.) que recebem estado e devolvem um novo estado, sem efeitos colaterais. Isso torna as regras de negócio (baixa de receita na produção, impedir estoque negativo na venda, exigir justificativa em ajuste, undo exato de movimentações) testáveis sem mocks, sem DOM e sem rede — e são a mesma lógica usada pelo `LocalStorageRepository`/`InMemoryRepository`.

A UI (`ui/`) nunca importa `infra/` nem chama o repositório diretamente — todo acesso passa pelo hook `useInventory`, que também centraliza o padrão "executa ação → recarrega estado" (agora assíncrono, com `loading`/`error`).

### De localStorage para Supabase: por que a porta mudou de forma

A primeira versão deste projeto guardava tudo em `localStorage`: um único dispositivo, sem concorrência. Ao migrar para um backend real usado por N dispositivos ao mesmo tempo, a pergunta central foi **onde garantir atomicidade** — por exemplo, duas vendas simultâneas do mesmo produto não podem, juntas, deixar o estoque negativo mesmo que cada uma isoladamente pareça válida no momento em que foi lida.

Isso só pode ser garantido por quem tem uma transação real com lock de linha: o banco. Por isso a porta `EstoqueRepository` deixou de ser um CRUD genérico (`listX`/`saveX`/`appendMovement`) manipulado por `application/*.ts`, e passou a expor diretamente os **casos de uso de negócio como métodos atômicos** (`registerSale`, `registerProduction`, `registerSupplyPurchase`, `adjustStock`, `undoMovement`). `application/*.ts` hoje são wrappers finos que só repassam para `repository.<método>()` — mantidos por consistência de import na UI, não porque orquestrem algo.

No adapter do Supabase, cada um desses métodos chama uma função `plpgsql` (`supabase/migrations/0001_init.sql`) que faz `select ... for update` na(s) linha(s) envolvida(s), valida a regra de negócio dentro da própria transação e só então grava — eliminando a corrida entre "ler saldo" e "gravar novo saldo" que existiria se a validação ficasse só no client. Erros de negócio (estoque insuficiente, insumo faltando, ajuste que resultaria em negativo) são levantados como `raise exception` com um payload JSON (`{"reason": "...", ...}`) e reconstituídos no client em `parseRpcError`, preservando os mesmos tipos de retorno discriminados que a versão local já usava.

**Trade-off assumido, não escondido:** as regras de negócio existem duplicadas — em TypeScript (`domain/inventory.ts`, `domain/production.ts`, usadas pelos adapters locais e pelos testes de domínio) e em SQL (usadas pelo adapter do Supabase, fonte da verdade para concorrência real). Alternativas (mover tudo para o banco via triggers only, ou tentar orquestrar locks otimistas no client) pareciam mais complexas para o ganho, dado que o volume de regras é pequeno e estável.

**Toda mutação de estoque gera uma `Movement` registrada** (venda, produção, compra de insumo, ajuste), tanto localmente quanto no Postgres. Não existe alteração de quantidade "solta": mesmo os ajustes manuais (com justificativa obrigatória) passam pelo mesmo mecanismo, o que permite desfazer (undo) qualquer operação de forma auditável.

**Desfazer é feito com o snapshot histórico, não com o estado atual.** Ao desfazer uma produção, o sistema devolve aos insumos exatamente as quantidades registradas em `consumed_supplies` no momento da produção — não recalcula com base na receita atual. Isso evita o problema clássico de "receita mudou depois, e o undo devolve a quantidade errada". Undos são soft-delete (`undone: true`), preservando o histórico.

**Dinheiro em centavos inteiros** (`Cents = number`) em vez de ponto flutuante, para evitar erros de arredondamento em preços.

**Quantidades de insumos usam arredondamento controlado** (6 casas decimais, tanto em `domain/inventory.ts` quanto via `round(...)` nas funções SQL) porque medidas fracionárias (kg, L) geram erro de ponto flutuante (ex.: `0.18 * 10 = 1.7999999999999998`). Sem esse cuidado, consumos de receita e reversões de produção acumulariam erro.

**Falhas de negócio esperadas usam tipos de retorno discriminados** (`{ ok: true, ... } | { ok: false, reason: ... }`), não `throw`. Exceções ficam reservadas para bugs/estado inválido, não para casos previstos como "estoque insuficiente" ou "insumo faltando".

**Login compartilhado, não multiusuário.** Os dois dispositivos autenticam com o mesmo e-mail/senha via Supabase Auth (`useAuth`); não há cadastro nem contas por pessoa. A política de RLS de cada tabela é `for all to authenticated using (true)` — qualquer sessão autenticada tem acesso total, já que não existe noção de "dono da linha" neste app.

**Modo offline é somente leitura, por decisão explícita.** Os dados lidos (GET) da API do Supabase ficam em cache via `runtimeCaching` do `vite-plugin-pwa` (Workbox `NetworkFirst`), então o app abre e mostra o último estado conhecido sem rede. Todas as ações de escrita (vender, produzir, comprar insumo, ajustar, desfazer, salvar cadastro, importar/apagar backup) são desabilitadas na UI quando `navigator.onLine` é falso (`useOnlineStatus`) — evitando o problema de reconciliar escritas feitas offline em múltiplos dispositivos, o que exigiria uma estratégia de sync/merge fora do escopo atual.

**`<dialog>` nativo em vez de modal customizado** (`Dialog.tsx`): fechamento com Esc e devolução de foco já vêm de graça do navegador. O ambiente de teste (jsdom) não implementa `showModal`/`close`, então há um polyfill mínimo em `src/test/setup.ts` só para os testes — o navegador real usa o comportamento nativo.

## Testes

Estratégia de cobertura, conforme a filosofia de teste do projeto:

- **`domain/`**: cobertura profunda de todas as regras de negócio (venda, produção, ajustes, relatório, dinheiro) — a maior parte dos testes vive aqui, sem mocks.
- **`application/`**: um teste por caso de uso, usando `InMemoryRepository` como fake — inclui o caso de undo com receita alterada posteriormente. `SupabaseEstoqueRepository` (as chamadas RPC/REST reais) não tem teste automatizado — validado manualmente contra o projeto Supabase.
- **`infra/`**: testes do adaptador de `localStorage` e das funções de backup/restauração.
- **`ui/`**: um a dois fluxos completos com Testing Library, renderizando `AppShell` (o miolo da tela, sem login/rede) com `InMemoryRepository` injetado — mantém a UI testável contra a porta `EstoqueRepository`, não contra o adapter concreto. Não há testes de breakpoint/responsividade.

```bash
npm test          # roda tudo uma vez
npm run test:watch
```

## PWA e ícones

O app é instalável e funciona offline (em modo leitura, ver acima) via `vite-plugin-pwa` (Workbox, `generateSW` + `runtimeCaching` para as leituras do Supabase). O ícone de marca em `public/icons/icon.svg` é um **placeholder temporário** (monograma "L'" em dourado sobre fundo grafite) até que os ativos reais da identidade visual da L'AUREA sejam fornecidos.

## Fora de escopo

Contas por usuário (o login é compartilhado entre os dois dispositivos), sincronização de escritas feitas offline, Redux/gerenciador de estado externo, container de injeção de dependência, integração com WhatsApp, funcionalidades financeiras e gráficos — deliberadamente não incluídos nesta versão.
