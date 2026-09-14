# Guia de uso — L'AUREA Estoque

Para quem vai usar o app no dia a dia. Cada parte diz **para que serve** e
**como testar**. Endereço: https://laurea-estoque.pages.dev

## Antes de tudo

- **Instalar no iPhone:** abra o endereço no Safari → Compartilhar (no iOS 26,
  dentro do botão "…") → **Adicionar à Tela de Início**. Abra sempre pelo ícone e
  faça o login lá dentro.
- **Login:** um só, compartilhado pelos dois celulares.
- **Os dois celulares veem o mesmo estoque.** O que um lança aparece no outro
  quando o app volta para a tela.
- **Sem internet** o app abre e mostra o último estado, mas não deixa lançar
  nada até a conexão voltar.
- **Errou?** Todo lançamento pode ser desfeito, e o que é desfeito não entra
  nos relatórios.

## 1. Primeiro uso: contar o estoque de hoje

O app começa com as velas e os insumos cadastrados, mas vários com estoque
zero. Sem isso, ele não deixa vender nem produzir.

- **Velas prontas:** Início → **Ajustar** → **Uma vela** → recipiente → aroma →
  no campo de ajuste, a quantidade que existe (ex.: `5`) → motivo
  **Recontagem** → Registrar.
- **Insumos** (pavio, frascos, adesivos, sacola, caixa, essências): Início →
  **Ajustar** → **Um insumo** → a quantidade que existe → **Recontagem**.

Use o Ajuste, e não a Entrada de insumo, para a contagem inicial: a Entrada
conta como compra e entraria no relatório de gastos.

## 2. Início — os lançamentos do dia a dia

A tela inicial pergunta **o que você vai lançar**. Depois é só escolher:
recipiente → aroma → preencher.

| Quadrado              | Para que serve                                                                                                                                    | Como testar                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Vender**            | Registrar uma vela que saiu. Tira do estoque e entra no faturamento                                                                               | Vender → Recipiente Fosco → Lavanda → quantidade 1. O valor vem preenchido; dá para mudar se tiver desconto |
| **Produzir**          | Registrar velas que ficaram prontas. Soma no estoque e **desconta sozinho** cera, essência, pavio, ilhós, frasco e adesivo, pela ficha técnica    | Produzir → Clássica Liso → Café → 2. Depois veja em Estoque → Insumos a cera diminuir 160 g                 |
| **Entrada de insumo** | Registrar uma compra de insumo. Com o **valor pago**, o app calcula o custo por kg e alimenta os relatórios de gastos e o custo de cada vela      | Entrada de insumo → Cera de coco → 2000 g e R$ 360,00 → aparece "Sai a R$ 180,00 por kg"                    |
| **Ajustar**           | Corrigir o estoque quando algo sai ou entra sem ser venda ou produção: brinde, quebra, sumiu, recontagem. **Número positivo soma, negativo tira** | Ajustar → Uma vela → -1 → motivo **Brinde**                                                                 |

**Depois de lançar**, a confirmação oferece:

- **Registrar outra** — volta para os aromas do mesmo recipiente, para lançar
  várias seguidas;
- **Desfazer** — cancela o lançamento e devolve o estoque;
- **Voltar ao início.**

**Atalhos:**

- Na escolha do recipiente, a **busca** pula direto para a vela: digite
  "lavanda fosco".
- Em Vender, vela sem estoque aparece apagada. Em Produzir, o app avisa antes
  quando falta algum insumo.
- A faixa vermelha **"X velas e Y insumos com estoque baixo"** leva direto ao
  Estoque.
- **Últimos lançamentos** mostra o que foi feito recentemente.

## 3. Estoque — consultar e cadastrar

| O quê                                          | Para que serve                                                                                            | Como testar                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Velas / Insumos**                            | Ver o que tem. O que está acabando aparece primeiro, marcado como "Estoque baixo" ou "Zerado"             | Estoque → Velas → um recipiente → veja os aromas         |
| **Detalhes**                                   | Tocar num item mostra estoque, preço, a partir de quanto avisa e a **ficha técnica**                      | Toque em qualquer vela                                   |
| **Editar vela / insumo**                       | Mudar preço, o **mínimo de alerta** e a ficha técnica                                                     | Mude o mínimo de uma vela para 3 e veja o aviso aparecer |
| **+ Nova vela / + Novo aroma / + Novo insumo** | Cadastrar o que ainda não existe. Dentro de um recipiente, "Novo aroma" já vem com o recipiente e o preço | (só se quiserem cadastrar algo novo)                     |

**Estoque baixo** = quando a quantidade chega no **mínimo de alerta** do item.
Hoje os mínimos estão em zero; vale ajustar os de cera, essências e frascos.

## 4. Relatório — como o negócio está indo

No topo, o **período**: Este mês, Mês passado, 7 dias, 30 dias ou
**Personalizado** (escolha De e Até). Tudo compara com o período anterior do
mesmo tamanho (▲ ▼).

| Relatório             | Responde                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Visão geral**       | Quanto entrou, saiu e sobrou; faturamento no tempo; aromas que mais venderam; **quanto sobra em cada vela**; o que está acabando |
| **Vendas**            | Faturamento, velas vendidas, ticket médio, por recipiente e por aroma, descontos dados                                           |
| **Produção**          | Quantas velas foram feitas e quanto de cada insumo foi usado                                                                     |
| **Saídas de estoque** | Tudo que saiu, por motivo: vendidas, brindes, quebras, perdas                                                                    |
| **Gastos**            | Quanto foi gasto com insumos, por categoria. Busca "Quanto gastei com…" (ex.: lavanda)                                           |
| **Histórico**         | Todos os lançamentos do período, com **Desfazer**                                                                                |

**Excel:** **Baixar relatório completo (Excel)** gera uma planilha com todas as
abas; dentro de cada relatório, **Exportar para Excel** gera só aquele. No
iPhone, abre o menu de compartilhar: **Salvar em Arquivos** ou mandar pelo
WhatsApp.

O **custo de cada vela** vem do valor pago nas entradas de insumo. Enquanto não
houver entradas com valor, o relatório mostra "sem custo" em vez de inventar.

## 5. Backup

| Botão               | Para que serve                                                                     |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Exportar backup** | Salva um arquivo com tudo (velas, insumos e histórico). Bom fazer de vez em quando |
| **Importar**        | Troca **todos** os dados atuais pelos de um backup. Só em caso de problema         |
| **Apagar tudo**     | Apaga tudo, sem volta. **Não mexam** sem falar comigo                              |

## 6. O que observar enquanto testam

- O que ficou **fácil**, o que ficou **confuso** e o que **faltou**.
- Algum número que pareça errado (estoque, valores, receita das velas).
- Qualquer tela em que ficaram sem saber o que fazer.
