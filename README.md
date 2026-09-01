# L'AUREA Estoque

PWA de controle de estoque para a L'AUREA Aromas (velas artesanais, Chapecó/SC). Cadastro de velas e insumos, produção com baixa automática de receita, registro de vendas, ajustes de estoque com justificativa, relatório mensal e backup/restauração local — tudo offline-first, sem backend e sem autenticação.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript (`strict`)
- [Tailwind CSS](https://tailwindcss.com/) para estilo
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) para testes
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) para instalação/offline
- ESLint + Prettier para qualidade e formatação
- GitHub Actions para CI (lint → typecheck → test → build)
- Persistência em `localStorage` (sem servidor)

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

## Decisões de arquitetura

O projeto segue **arquitetura hexagonal (ports & adapters)**, organizada em quatro camadas com fronteiras estritas:

```
src/
  domain/        regras de negócio puras — zero I/O, zero React, zero Date() direto
  application/   casos de uso — orquestram o domínio e o repositório (injetado por parâmetro)
  infra/         adaptadores — implementações do repositório (localStorage, backup, schema)
  ui/            componentes React — nunca chamam o repositório diretamente
```

**Por que essa separação.** O domínio (`domain/`) contém apenas funções puras (`sell`, `produce`, `adjustProductQuantity`, `getMonthlyReport`, etc.) que recebem estado e devolvem um novo estado, sem efeitos colaterais. Isso torna as regras de negócio (baixa de receita na produção, impedir estoque negativo na venda, exigir justificativa em ajuste, undo exato de movimentações) testáveis sem mocks, sem DOM e sem storage.

A camada `application/` (um caso de uso por arquivo: `registerSale`, `registerProduction`, `registerSupplyPurchase`, `adjustStock`, `undoMovement`, `getMonthlyReport`) recebe o repositório como **parâmetro de função**, não via container de injeção de dependência. Isso mantém o código explícito e testável com uma fake (`InMemoryRepository`) sem nenhuma configuração adicional.

A UI (`ui/`) nunca importa `infra/` nem chama o repositório diretamente — todo acesso passa pelos casos de uso via o hook `useInventory`, que também centraliza o padrão "executa ação → recarrega estado".

**Toda mutação de estoque gera uma `Movement` registrada** (venda, produção, compra de insumo, ajuste). Não existe alteração de quantidade "solta": mesmo os ajustes manuais (com justificativa obrigatória) passam pelo mesmo mecanismo, o que permite desfazer (undo) qualquer operação de forma auditável.

**Desfazer é feito com o snapshot histórico, não com o estado atual.** Ao desfazer uma produção, o sistema devolve aos insumos exatamente as quantidades registradas em `consumed` no momento da produção — não recalcula com base na receita atual. Isso evita o problema clássico de "receita mudou depois, e o undo devolve a quantidade errada". Undos são soft-delete (`undone: true`), preservando o histórico.

**Dinheiro em centavos inteiros** (`Cents = number`) em vez de ponto flutuante, para evitar erros de arredondamento em preços.

**Quantidades de insumos usam arredondamento controlado** (`roundQuantity`, 6 casas decimais) porque medidas fracionárias (kg, L) geram erros de ponto flutuante em JavaScript (ex.: `0.18 * 10 = 1.7999999999999998`). Sem esse cuidado, consumos de receita e reversões de produção acumulariam erro.

**Falhas de negócio esperadas usam tipos de retorno discriminados** (`{ ok: true, ... } | { ok: false, reason: ... }`), não `throw`. Exceções ficam reservadas para bugs/estado inválido, não para casos previstos como "estoque insuficiente" ou "insumo faltando".

**`<dialog>` nativo em vez de modal customizado** (`Dialog.tsx`): fechamento com Esc e devolução de foco já vêm de graça do navegador. O ambiente de teste (jsdom) não implementa `showModal`/`close`, então há um polyfill mínimo em `src/test/setup.ts` só para os testes — o navegador real usa o comportamento nativo.

## Testes

Estratégia de cobertura, conforme a filosofia de teste do projeto:

- **`domain/`**: cobertura profunda de todas as regras de negócio (venda, produção, ajustes, relatório, dinheiro) — a maior parte dos testes vive aqui, sem mocks.
- **`application/`**: um teste por caso de uso, usando `InMemoryRepository` como fake — inclui o caso de undo com receita alterada posteriormente.
- **`infra/`**: testes do adaptador de `localStorage` e das funções de backup/restauração.
- **`ui/`**: um a dois fluxos completos com Testing Library (registrar venda com baixa de estoque; ver alerta de estoque baixo) — não há testes de breakpoint/responsividade.

```bash
npm test          # roda tudo uma vez
npm run test:watch
```

## PWA e ícones

O app é instalável e funciona offline via `vite-plugin-pwa` (Workbox, `generateSW`). O ícone de marca em `public/icons/icon.svg` é um **placeholder temporário** (monograma "L'" em dourado sobre fundo grafite) até que os ativos reais da identidade visual da L'AUREA sejam fornecidos.

## Fora de escopo

Autenticação, Redux/gerenciador de estado externo, container de injeção de dependência, integração com WhatsApp, funcionalidades financeiras e gráficos — deliberadamente não incluídos nesta versão.
