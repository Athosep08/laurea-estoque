# Roteiro de deploy — L'AUREA Estoque

Como colocar o app no ar pela primeira vez, e como publicar versões novas
depois. Escrito para ser seguido de cima para baixo, marcando cada caixa.

## Como as peças se encaixam

```
Celular / navegador
      │  abre o site (HTML, JS, CSS)
      ▼
┌──────────────────────┐   API    ┌───────────────────────────┐
│ Cloudflare Pages     │  ─────►  │ Supabase                  │
│ serve a pasta dist/  │          │ Postgres + login + API    │
│ (gerada pelo build)  │          │ (projeto já existe)       │
└──────────────────────┘          └───────────────────────────┘
          ▲
          │ publica sozinha a cada push na main
┌──────────────────────┐
│ GitHub               │
│ Athosep08/laurea-estoque (privado)
└──────────────────────┘
```

- **Supabase** é só o back-end: dados, login e API. Ele não hospeda o site.
- **Cloudflare Pages** hospeda o site, na mesma conta onde já está a landing
  page, mas num **projeto separado**. Motivos: o app instala um service
  worker na raiz do endereço (é o que faz ele funcionar offline e virar app
  no celular) e, no mesmo endereço da landing, passaria a controlar a landing
  também; a landing é publicada por upload manual e o app publica sozinho a
  cada push; e o app é interno, não deve ficar no endereço público da marca.
  O plano gratuito da Cloudflare permite uso comercial.
- **GitHub Actions** (`.github/workflows/ci.yml`) roda lint, typecheck,
  testes e build a cada push. Ele não publica nada: só avisa se quebrou.

---

## Parte 1 — Supabase (uma vez)

Tudo no painel do projeto em [supabase.com](https://supabase.com/dashboard).

### 1.0 Se aparecer "Project is paused"

O plano gratuito pausa o projeto depois de 7 dias sem nenhum acesso. Os dados
continuam lá.

- [ ] Clique em **Resume project** (não precisa do Upgrade) e espere de 2 a
      5 minutos, até o painel normal voltar.

Com o app em uso diário isso não acontece; o risco é só em períodos parados,
como antes do lançamento. Se o app aparecer fora do ar depois de um tempo sem
uso, é isso: entre no painel e clique em Resume de novo.

### 1.1 Descobrir o que já foi aplicado

No **SQL Editor**, rode:

```sql
select
  (select count(*) from pg_tables where tablename = 'movements') as tem_0001,
  (select count(*) from products) as produtos,
  (select pg_get_function_identity_arguments(oid)
     from pg_proc where proname = 'register_supply_purchase') as funcao_entrada;
```

| Resultado                                    | Significa                                              |
| -------------------------------------------- | ------------------------------------------------------ |
| Dá erro `relation "products" does not exist` | Nada foi aplicado. Rode 0001, 0003 e 0002, nessa ordem |
| `tem_0001 = 1` e `produtos = 0`              | Só o 0001. Rode 0003 e 0002                            |
| `funcao_entrada` termina em `integer`        | O 0003 já foi aplicado                                 |
| `produtos = 42`                              | O 0002 (carga inicial) já foi aplicado                 |

### 1.2 Rodar as migrations que faltam

Sempre pelo **SQL Editor**, colando o arquivo inteiro e clicando em Run.

- [ ] [`0001_init.sql`](../supabase/migrations/0001_init.sql) — tabelas, regras de acesso e funções.
- [ ] [`0003_valor_pago_entrada.sql`](../supabase/migrations/0003_valor_pago_entrada.sql) — valor pago na entrada de insumo. **Precisa estar aplicada antes do app novo ir ao ar**, senão toda entrada de insumo dá erro.
- [ ] [`0002_carga_inicial.sql`](../supabase/migrations/0002_carga_inicial.sql) — os 24 insumos e as 42 velas.
  - Atenção: vários estoques ainda estão em zero, esperando a 2ª rodada de
    respostas do stakeholder (ver [perguntas-stakeholder.md](perguntas-stakeholder.md)).
    Dá para rodar agora e corrigir pelo app depois (Ajustar → Recontagem), ou
    preencher os `-- TODO` do arquivo antes.
  - Rodar duas vezes não duplica nada, mas também **não atualiza** o que já
    existe. Para corrigir estoque depois, use o app.

### 1.3 Fechar o cadastro público — obrigatório

As regras de acesso deixam **qualquer usuário logado** ler e alterar tudo
(o login é um só, compartilhado). E a chave que o app usa é pública: ela vai
dentro do site. Se o cadastro de novos usuários ficar aberto, qualquer pessoa
consegue criar uma conta pelo site e mexer no estoque.

- [ ] **Authentication → Sign In / Providers → Email**: desligue
      **"Allow new users to sign up"** e salve.
- [ ] Confirme em **Authentication → Users** que só existe o usuário
      compartilhado de vocês.

### 1.4 Usuário compartilhado

- [ ] Se ainda não existe: **Authentication → Users → Add user**, com o
      e-mail e a senha que os dois aparelhos vão usar, marcando
      **"Auto Confirm User"**.

### 1.5 Pegar as chaves

- [ ] **Project Settings → API Keys** (em projetos mais antigos, **Settings →
      API**): anote a **Project URL** e a chave **pública** — chamada `anon`
      nos projetos antigos e `publishable` nos novos; as duas funcionam.
      Nunca use a `service_role` / `secret` no app: ela ignora as regras de
      acesso.

---

## Parte 2 — Cloudflare Pages (uma vez)

Na mesma conta da Cloudflare onde está a landing, em
[dash.cloudflare.com](https://dash.cloudflare.com).

- [ ] Menu **Workers & Pages** → **Create**. Escolha a opção **Pages** (a
      Cloudflare mostra Workers primeiro; o Pages fica numa aba ou num link
      "Looking to deploy Pages?") → **Import an existing Git repository**
      (Connect to Git).
- [ ] Conecte o GitHub (conta `Athosep08`) e dê acesso ao repositório
      `laurea-estoque`. Ele é privado; a Cloudflare pede permissão só para os
      repositórios que você escolher.
- [ ] Configure:
  - Project name: `laurea-estoque` (vira o endereço `laurea-estoque.pages.dev`)
  - Production branch: `main`
  - Framework preset: **React (Vite)** (ou **None**, tanto faz com os campos abaixo)
  - Build command: `npm run build`
  - Build output directory: `dist`
- [ ] Em **Environment variables** (Production), cadastre as três:
  - `VITE_SUPABASE_URL` = a Project URL (a mesma do `.env.local`)
  - `VITE_SUPABASE_ANON_KEY` = a chave pública (a mesma do `.env.local`)
  - `NODE_VERSION` = `20` (a mesma versão que o GitHub Actions usa)
  - **Não** cadastre `VITE_DEMO`: o modo demonstração é só para o localhost.
- [ ] **Save and Deploy.** Em dois ou três minutos o site está em
      `https://laurea-estoque.pages.dev`.

As variáveis entram no app **na hora do build**. Se mudar alguma depois, é
preciso publicar de novo: **Deployments → ⋯ na última → Retry deployment**.

### 2.1 Domínio próprio (opcional)

Se a landing usa um domínio próprio que está na Cloudflare (ex.:
`laureaaromas.com.br`), dá para pôr o app num subdomínio:

- [ ] No projeto `laurea-estoque` → **Custom domains → Set up a custom
      domain** → `estoque.<seu-domínio>`. A Cloudflare cria o DNS sozinha.

### 2.2 Avisar o Supabase do endereço novo

- [ ] **Authentication → URL Configuration → Site URL**: cole o endereço do
      app (`https://laurea-estoque.pages.dev`, ou o subdomínio). O login por
      senha funciona sem isso, mas é o endereço que o Supabase usa em
      qualquer e-mail que mandar (ex.: recuperar senha).

### Alternativa: Vercel

Funciona igual (importar o repositório, preset Vite, as duas variáveis
`VITE_*`). Só que o plano gratuito da Vercel (Hobby) é **para uso não
comercial**; para um app de empresa, seria o plano Pro, pago.

---

## Parte 3 — Conferir que está no ar

Abra o endereço do app no celular:

- [ ] A tela de login aparece. Entre com o usuário compartilhado.
- [ ] O Início mostra os 4 quadrados e **não** mostra a faixa "Modo demonstração".
- [ ] Estoque lista as 42 velas e os 24 insumos (se o 0002 foi rodado).
- [ ] Faça uma **entrada de insumo com valor pago** e desfaça na confirmação.
      Se der erro, o 0003 não foi aplicado.
- [ ] Relatório abre e o **Baixar relatório completo (Excel)** gera o arquivo.
- [ ] Instale como app:
  - Android (Chrome): menu ⋮ → **Adicionar à tela inicial**.
  - iPhone (Safari): **Compartilhar → Adicionar à Tela de Início**.
- [ ] Tente criar uma conta nova pelo site (não deve ser possível).

---

## Parte 4 — Publicar versões novas (dia a dia)

1. **Se a versão tem migration nova** (`supabase/migrations/0004_…`), rode no
   SQL Editor **antes** do push. As migrations deste projeto são escritas
   para o app antigo continuar funcionando depois delas; o contrário (app
   novo com banco antigo) quebra.
2. `git push` na `main`. A Cloudflare publica sozinha; o GitHub Actions roda
   os testes em paralelo. Se o build falhar na Cloudflare, o site continua na
   versão anterior.
3. Se algo quebrar no ar: no projeto da Cloudflare, **Deployments → a versão
   anterior → ⋯ → Rollback to this deployment** volta o site na hora.
   Migration não volta sozinha: por isso elas são escritas para conviver com o
   app anterior.

Dica: faça mudanças maiores numa branch. A Cloudflare gera um endereço de
pré-visualização para cada branch (`<branch>.laurea-estoque.pages.dev`), bom
para mostrar ao stakeholder antes de ir para a `main`. Para essas prévias
funcionarem, cadastre as mesmas variáveis também em **Preview**.

---

## Custos

Tudo cabe nos planos gratuitos para esse volume de uso:

- **Cloudflare Pages Free**: permite uso comercial; 500 builds por mês (um por
  push), sobra.
- **Supabase Free**: 500 MB de banco, sobra para anos de lançamentos. O
  projeto gratuito **pausa depois de 7 dias sem nenhum acesso** (ver 1.0);
  com uso diário, isso não acontece.
