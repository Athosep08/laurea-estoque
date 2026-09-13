# Roteiro de deploy — L'AUREA Estoque

Como colocar o app no ar pela primeira vez, e como publicar versões novas
depois. Escrito para ser seguido de cima para baixo, marcando cada caixa.

## Como as peças se encaixam

```
Celular / navegador
      │  abre o site (HTML, JS, CSS)
      ▼
┌──────────────────────┐   API    ┌───────────────────────────┐
│ Vercel               │  ─────►  │ Supabase                  │
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
- **Vercel** hospeda o site. Qualquer hospedagem de site estático serve
  (Cloudflare Pages e Netlify funcionam igual); a Vercel foi escolhida por
  entender projetos Vite sem configuração e publicar a cada push.
- **GitHub Actions** (`.github/workflows/ci.yml`) roda lint, typecheck,
  testes e build a cada push. Ele não publica nada: só avisa se quebrou.

---

## Parte 1 — Supabase (uma vez)

Tudo no painel do projeto em [supabase.com](https://supabase.com/dashboard).

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

## Parte 2 — Vercel (uma vez)

- [ ] Crie a conta em [vercel.com](https://vercel.com) entrando com o GitHub
      (conta `Athosep08`).
- [ ] **Add New… → Project** e escolha o repositório `laurea-estoque`.
      Como ele é privado, a Vercel vai pedir permissão para acessá-lo.
- [ ] Confira o que ela detectar sozinha:
  - Framework Preset: **Vite**
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Install Command: `npm ci` (ou o padrão)
- [ ] Em **Environment Variables**, cadastre as duas da parte 1.5:
  - `VITE_SUPABASE_URL` = a Project URL
  - `VITE_SUPABASE_ANON_KEY` = a chave `anon`
  - **Não** cadastre `VITE_DEMO`: o modo demonstração é só para o localhost.
- [ ] **Deploy.** Em um ou dois minutos sai um endereço como
      `laurea-estoque.vercel.app`.

### 2.1 Avisar o Supabase do endereço novo

- [ ] **Authentication → URL Configuration → Site URL**: cole o endereço da
      Vercel. O login por senha funciona sem isso, mas é o endereço que o
      Supabase usa em qualquer e-mail que mandar (ex.: recuperar senha).

---

## Parte 3 — Conferir que está no ar

Abra o endereço da Vercel no celular:

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
2. `git push` na `main`. A Vercel publica sozinha; o GitHub Actions roda os
   testes em paralelo.
3. Se algo quebrar no ar: na Vercel, **Deployments → a versão anterior → ⋯ →
   Promote to Production** volta o site na hora. Migration não volta sozinha:
   por isso elas são escritas para conviver com o app anterior.

Dica: faça mudanças maiores numa branch. A Vercel gera um endereço de
pré-visualização para cada branch, bom para mostrar ao stakeholder antes de
ir para a `main`.

---

## Custos

O Supabase cabe no plano gratuito com folga; a hospedagem depende da escolha:

- **Vercel**: o plano gratuito (Hobby) é **só para uso não comercial**. Como
  o app é de uma empresa, o correto é o plano Pro (pago, por membro) — ou
  trocar a Vercel pela **Cloudflare Pages**, que é gratuita também para uso
  comercial e funciona do mesmo jeito (conecta no GitHub, publica a cada
  push; Build command `npm run build`, pasta `dist`, mesmas duas variáveis, e
  a variável `NODE_VERSION=20`).
- **Supabase Free**: 500 MB de banco, sobra para anos de lançamentos. O
  projeto gratuito **pausa depois de 7 dias sem nenhum acesso**; basta abrir o
  painel para reativar. Com uso diário, isso não acontece.
