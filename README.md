# L'AUREA Estoque

PWA de estoque, produção e relatórios para a L'AUREA Aromas — velas artesanais feitas em Chapecó/SC. Duas pessoas, um login compartilhado, uso no celular durante a produção e a venda.

**No ar:** [laurea-estoque.pages.dev](https://laurea-estoque.pages.dev) · Cloudflare Pages + Supabase (Postgres, `sa-east-1`)

Este README é a documentação técnica do projeto: as decisões que tomei, os caminhos que escolhi e o que assumi em troca. O passo a passo de operação está em [`docs/deploy.md`](docs/deploy.md); o guia para quem usa o app, em [`docs/guia-de-uso.md`](docs/guia-de-uso.md).

|                         |                                                                                |
| ----------------------- | ------------------------------------------------------------------------------ |
| Código                  | ~7.400 linhas de TypeScript `strict` + 741 de SQL                              |
| Testes                  | 155 em 20 arquivos, sem mock de rede                                           |
| Dados reais             | 24 insumos, 42 produtos (3 recipientes × 14 aromas), cada um com ficha própria |
| Dependências de runtime | 4: `react`, `react-dom`, `@supabase/supabase-js`, `write-excel-file`           |

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript `strict`
- [Supabase](https://supabase.com/) — Postgres, Auth e API; a lógica de concorrência vive em funções `plpgsql`
- [Tailwind CSS](https://tailwindcss.com/) com tokens da identidade da marca
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) para instalação e leitura offline
- ESLint + Prettier, e GitHub Actions rodando lint → typecheck → test → build

## Arquitetura

Arquitetura hexagonal (ports & adapters), com quatro camadas e fronteiras que os imports respeitam:

```
src/
  domain/        regras puras — sem I/O, sem React, sem new Date() solto
  application/   casos de uso — hoje delegadores finos para a porta
  infra/         adaptadores — Supabase (produção), localStorage e memória (demo e testes)
  ui/            React — nunca importa infra/ nem chama o repositório direto
supabase/
  migrations/    schema, RLS e funções RPC: a fonte da verdade do backend
```

O caminho de uma ação é sempre o mesmo:

```
componente → useInventory → application/<caso de uso> → EstoqueRepository (porta)
                                                          ├── SupabaseEstoqueRepository → RPC plpgsql
                                                          ├── LocalStorageRepository ──┐
                                                          └── InMemoryRepository ──────┴→ domain/
```

O hook `useInventory` é o único ponto que a UI conhece. Ele centraliza o padrão "executa a ação → recarrega o estado" e expõe `loading` e `error`, então nenhum componente invalida cache na mão.

## Decisões técnicas

### Atomicidade no banco, não no cliente

A primeira versão guardava tudo em `localStorage`: um aparelho, zero concorrência. Ao migrar para um backend de verdade, com dois celulares no mesmo estoque, a pergunta central passou a ser **onde garantir atomicidade**. Duas vendas simultâneas da mesma vela não podem, somadas, deixar o estoque negativo, mesmo que cada uma pareça válida no instante em que leu o saldo.

Só quem tem transação e lock de linha resolve isso: o banco. Então a porta `EstoqueRepository` deixou de ser um CRUD genérico (`listX` / `saveX` / `appendMovement`) orquestrado no cliente e passou a expor **os casos de uso como métodos atômicos**: `registerSale`, `registerProduction`, `registerSupplyPurchase`, `adjustStock`, `undoMovement`.

No adapter do Supabase, cada um chama uma função `plpgsql` que dá `select … for update` nas linhas envolvidas, valida a regra dentro da própria transação e só então grava. Isso elimina a corrida entre ler o saldo e gravar o novo. Erros de negócio sobem como `raise exception` com um payload JSON (`{"reason": "insufficient_stock", …}`) e voltam a ser tipos discriminados no cliente, os mesmos que a versão local já usava.

**O trade-off, explícito:** as regras existem duas vezes — em TypeScript (`domain/inventory.ts`, `domain/production.ts`, usadas pelos adapters locais e pelos testes) e em SQL (fonte da verdade sob concorrência real). Considerei empurrar tudo para o banco com triggers, ou fazer lock otimista no cliente; para um conjunto de regras pequeno e estável, as duas alternativas custavam mais do que entregavam.

### Estoque é um livro de lançamentos, não um número editável

Nenhuma quantidade muda "solta". Venda, produção, entrada de insumo e ajuste geram um `Movement`, inclusive os ajustes manuais, que exigem justificativa. É o que torna o histórico auditável e qualquer operação reversível.

**Desfazer usa o retrato do passado, não a receita de hoje.** Ao desfazer uma produção, o app devolve aos insumos exatamente o que ficou registrado em `consumed_supplies` naquele momento. Se a ficha técnica mudou depois, o undo continua correto — o erro clássico de recalcular pela receita atual não acontece. Undo é soft delete (`undone: true`), então o histórico nunca perde a linha.

### Dinheiro e medidas

Dinheiro é **centavo inteiro** (`Cents = number`) do banco à tela; nenhum preço passa por ponto flutuante. Quantidades de insumo usam **arredondamento controlado em 6 casas**, no TypeScript e no SQL, porque medida fracionária acumula erro (`0.18 * 10 = 1.7999999999999998`). Sem isso, consumo de receita e reversão de produção iriam derivando.

### Falha prevista é retorno; falha inesperada tem que aparecer

Casos previstos — estoque insuficiente, insumo faltando, ajuste que deixaria negativo — são retorno discriminado (`{ ok: true } | { ok: false, reason }`), não exceção. Exceção fica para bug e estado inválido.

O que a produção me ensinou: **isso não basta**. Uma falha de infraestrutura (erro do Postgres, conexão caindo, sessão vencida) subia como promessa rejeitada e ninguém a tratava, então a tela ficava idêntica. Quem usava clicava em "Registrar produção" e nada acontecia — o pior tipo de defeito, o que não deixa pista. Hoje toda falha inesperada vira texto na tela, com o detalhe técnico no fim para quem for relatar, e sessão vencida tem mensagem própria dizendo o que fazer ([`src/ui/failureMessage.ts`](src/ui/failureMessage.ts)).

### Login compartilhado, e o que isso obriga

São duas pessoas e um login: não existe conta por pessoa nem noção de dono da linha, então a política de RLS é `for all to authenticated using (true)`. A consequência é que **fechar o cadastro público não é opcional** — a chave `anon` viaja dentro do site, e com o cadastro aberto qualquer pessoa criaria uma conta e entraria no estoque. O roteiro de deploy trata esse passo como obrigatório e mostra como conferir pela API.

### Offline é somente leitura, por decisão

As leituras da API ficam em cache com Workbox (`NetworkFirst`), então o app abre sem rede e mostra o último estado conhecido. Toda escrita é desabilitada quando `navigator.onLine` é falso.

Escrita offline exigiria reconciliar lançamentos feitos em dois aparelhos sem conexão — merge, resolução de conflito, fila de sincronização. Para um estoque em que os dois lançam do mesmo lugar e quase sempre com sinal, o custo não se justificava ainda. A decisão é reversível e está isolada: passaria por `useOnlineStatus` e pelo adapter, não pelo domínio.

Os dois aparelhos veem o mesmo estoque, então `useInventory` recarrega quando a aba volta a ficar visível e quando a conexão retorna. Sem isso, um celular só veria o lançamento do outro depois de fechar e abrir o app — e no iPhone, voltar para um app em segundo plano não recarrega nada.

### Relatórios como funções puras

Todo o cálculo é função pura em [`src/domain/reports.ts`](src/domain/reports.ts), com o `now` recebido por parâmetro: dá para testar qualquer período sem congelar o relógio. Três regras que valem registrar:

- **Fuso local, sempre.** Datas são montadas e formatadas em horário local, nunca por `toISOString()`, senão às 22h em Chapecó um lançamento cairia no dia seguinte.
- **Custo de insumo é média ponderada** das entradas que têm valor pago, sobre todo o histórico. Insumo sem nenhuma entrada com valor aparece como "sem custo": o relatório não inventa número, e a margem da vela deixa de ser exibida em vez de mentir.
- **Categoria de insumo é deduzida do nome** (Cera, Essências, Frascos, Montagem, Embalagem), porque o cadastro não tem esse campo e criá-lo obrigaria o cliente a classificar 24 itens antes de ver o primeiro relatório.

A granularidade do gráfico acompanha o período: por dia até dois meses, por semana até um ano, por mês acima disso.

### Excel sem acoplar a planilha ao domínio

O conteúdo da planilha é montado como modelo puro em [`src/application/reportWorkbook.ts`](src/application/reportWorkbook.ts) e só depois vira arquivo em [`src/infra/export/xlsxWorkbook.ts`](src/infra/export/xlsxWorkbook.ts), com `write-excel-file` carregada por import dinâmico — quem nunca exporta não baixa a biblioteca. Dinheiro vai como **número** com formato de real, não texto, para somar e filtrar no Excel. Somas são feitas em centavos e convertidas no fim, senão a planilha mostra `167.70000000000002`.

No iPhone com o app instalado na tela inicial, download direto não funciona de forma confiável, então o arquivo sai pelo menu de compartilhar do sistema ([`src/ui/saveFile.ts`](src/ui/saveFile.ts)).

### Detalhes que economizaram código

- **`<dialog>` nativo** em vez de modal próprio: Esc e devolução de foco vêm do navegador. O jsdom não implementa `showModal`, então existe um polyfill mínimo em `src/test/setup.ts`, só para os testes.
- **Seed idempotente:** os IDs da carga inicial vêm de `md5('laurea:<tipo>:<nome>')`, então rodar a migration duas vezes não duplica nada. Ela também aborta sem gravar se algum preço estiver zerado, para não cadastrar 42 produtos a R$ 0,00.
- **Modo demonstração** (`npm run dev:demo`) roda o app inteiro sobre `localStorage`, com 75 dias de histórico determinístico. Serve para validar com o cliente e para apresentar o projeto sem expor o banco. Sai do build de produção por tree-shaking.

## Testes

155 testes, nenhum mock de rede. A cobertura é proporcional ao risco, não uniforme:

- **`domain/`** — a maior parte. Todas as regras de negócio, sem mock e sem DOM.
- **`application/`** — um teste por caso de uso sobre `InMemoryRepository`, incluindo o undo de produção cuja receita mudou depois.
- **`infra/`** — adapter de `localStorage`, backup e restauração, seed da demonstração e a gravação real do `.xlsx`, lido de volta com `FileReader` e conferido célula a célula.
- **`ui/`** — fluxos completos com Testing Library, renderizando `AppShell` com repositório injetado: a UI é testada contra a porta, nunca contra o adapter concreto. Inclui o caso da falha inesperada, que antes era silenciosa.

O que deliberadamente **não** tem teste automatizado: as chamadas RPC reais do `SupabaseEstoqueRepository`, validadas contra o projeto de verdade, e responsividade por breakpoint.

## Rodando

```bash
npm install
npm run dev          # precisa de .env.local com as chaves do Supabase
npm run dev:demo     # sem banco e sem login, dados no localStorage
npm test
npm run lint && npm run typecheck && npm run build
```

Para uma instância nova: crie o projeto no Supabase, rode as três migrations de [`supabase/migrations/`](supabase/migrations/) na ordem, feche o cadastro público, crie o usuário compartilhado e preencha `.env.local` a partir de [`.env.example`](.env.example) com a URL e a chave `anon` (nunca a `service_role`). Cada passo, com o que conferir depois, está em [`docs/deploy.md`](docs/deploy.md).

## Fora de escopo nesta versão

Conta por pessoa, sincronização de escrita offline, gerenciador de estado externo, container de injeção de dependência, integração com WhatsApp e módulo financeiro. Cada ausência é escolha, não pendência: o app resolve o estoque de duas pessoas que fazem velas, e cresce por cadastro — aroma, recipiente e insumo novos entram pela própria tela, sem release.

---

Desenvolvido por **Athos Enderle Puña** · [LinkedIn](https://www.linkedin.com/in/athos-enderle-puna-176480277/) · [GitHub](https://github.com/Athosep08)

Código 100% gerado com IA, sob a minha direção técnica: arquitetura, decisões de modelagem, escopo e revisão.
