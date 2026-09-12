# Perguntas ao stakeholder — insumos e fichas técnicas

| Rodada | Enviada | Status |
|---|---|---|
| 1ª — 20 perguntas | 2026-09-09 | Respondida em 2026-09-09 (Mateus) |
| 2ª — 13 pendências abaixo | — | **A enviar** |

O resultado da 1ª rodada está em
[`supabase/migrations/0002_carga_inicial.sql`](../supabase/migrations/0002_carga_inicial.sql).
Os valores que ainda faltam estão marcados com `-- TODO` nesse arquivo.

---

## 2ª rodada — o que ainda falta

Os preços não precisam mais ser perguntados: saíram da landing page
(ver "Fontes complementares" no fim). Comparar a landing com as respostas
dele levantou três dúvidas novas de catálogo, que são as primeiras abaixo.

### Catálogo

1. O que você chama de **"200g liso"** é o **Recipiente Fosco** da landing page?
   - [ ] Resposta:
   - _(Na landing, "Liso" é o nome da vela de 90g, e as de 200g são "Fosco" e "Refinado". O seed já assume que 200g liso = Fosco.)_
2. Na landing, **"Capim Limão e Alecrim"** é um aroma só. É uma vela feita com as duas essências juntas? Se for, quanto vai de cada uma?
   - [ ] Resposta:
   - _(Se for uma mistura, vira um produto que consome duas essências, e não duas velas separadas como está hoje no seed.)_
3. **Apple Cake, Coco e Santal** não aparecem na landing. Viraram velas novas, ou essas essências são para outra coisa (pedido exclusivo, home spray)?
   - [ ] Resposta:
   - _(O seed hoje cria vela nos três modelos para todas as 14 essências. As que não forem vela ficam só como insumo.)_

### Bloqueia a primeira produção

Sem esses números o estoque desses insumos começa em zero, e o sistema recusa qualquer produção por falta de pavio, frasco etc. (testado).

4. Quantos tem hoje de:
   - [ ] Pavio:
   - [ ] Ilhós médio:
   - [ ] Frasco 90g liso (com tampa):
   - [ ] Frasco 200g fosco:
   - [ ] Frasco 200g canelado:
   - [ ] Adesivo da vela:
   - [ ] Adesivo da sacola:
   - [ ] Sacola:
   - [ ] Caixa:
5. O estoque de essência veio até o Alecrim. **Faltam 5 aromas**:
   - [ ] Capim Limão: g
   - [ ] Bergamota: g
   - [ ] Vanilla Prime: g
   - [ ] Canela: g
   - [ ] Santal: g

### Carga inicial e alertas

6. Quantas velas prontas têm hoje, por modelo e aroma?
   - [ ] Resposta:
7. A partir de qual quantidade querem ser **avisados** de que um insumo está acabando? (ex.: "me avisa quando a cera chegar em 2 kg")
   - [ ] Resposta:

### Confirmações rápidas

8. O pavio rende duas velas **também no frasco de 200g**, ou isso vale só para o 90g?
   - [ ] Resposta:
   - _(Hoje a ficha usa 0,5 pavio por vela nos três modelos.)_
9. O adesivo da vela é colado **quando a vela fica pronta** ou só na hora da venda?
   - [ ] Resposta:
   - _(Hoje ele sai do estoque na produção. Se for colado só na venda, sai da ficha técnica.)_
10. Numa venda de 3 velas, vai **1 sacola** (ou caixa) ou uma por vela?
    - [ ] Resposta:
11. Quando compram essência (frasco de 100 ml ou 250 ml), o **peso em gramas** vem no rótulo?
    - [ ] Resposta:
    - _(O sistema controla essência em gramas, e cada essência tem um peso diferente por ml. Na hora de registrar a compra vai precisar do peso: ou pelo rótulo, ou pesando o frasco.)_
12. A sacola tem **tamanho único**? E a caixa?
    - [ ] Resposta:
    - _(Estava na 1ª rodada e ficou sem resposta. Se tiver mais de um tamanho, cada tamanho vira um insumo separado.)_

### Pedidos exclusivos (baixa prioridade)

13. A landing oferece, nos pedidos exclusivos, **cor do recipiente, laço e rótulo personalizado**. Corante, laço e rótulo personalizado são insumos que vocês querem controlar no sistema também?
    - [ ] Resposta:
    - _(Na 1ª rodada ele disse que não falta insumo na lista, então pode ser que isso seja comprado sob encomenda. Não bloqueia nada.)_

---

## 1ª rodada — respostas recebidas (2026-09-09)

**Receita da vela**

- Vela 90g: **80 g de cera + 10 g de essência**.
- Vela 200g (liso e refinado): **180 g de cera + 20 g de essência**.
- Ou seja, "90g" e "200g" são o peso da vela pronta, e a essência é medida em **gramas**.
- Pavio: o mesmo nos três modelos, comprado pronto. Como é cortado no tamanho do frasco, geralmente um pavio dá para **duas velas**.
- Ilhós: compram só o de **tamanho médio**.

**Essências**

- **Cada essência é estocada separada.** As que saem mais, compram em frasco maior (250 ml; os outros são de 100 ml). Cada essência tem um peso diferente por ml.
- 14 aromas: Café, Apple Cake, Lavanda, Flor de Laranjeira, Flor de Figo, Bamboo, Coco, Cereja e Avelã, Alecrim, Capim Limão, Bergamota, Vanilla Prime, Canela, Santal.
- Estoque informado: Café 224 g, Apple Cake 230 g, Lavanda 300 g, Flor de Laranjeira 34 g, Flor de Figo 200 g, Bamboo 120 g, Coco 100 g, Cereja e Avelã 260 g, Alecrim 26 g.

**Outros insumos**

- Só **cera de coco**. Estoque: **12 kg**.
- Os três frascos são todos diferentes. Só o de 90g tem tampa, e ela já vem junto com o frasco — não é um insumo separado.
- Não falta insumo na lista, mas **às vezes usam caixa no lugar da sacola**.
- São **dois adesivos**: um vai na vela, outro na sacola. Os dois entram em **todas** as vendas.

**Processo e preço**

- Produzem **unidade por unidade**. A perda é pequena, porque pesam antes de fazer.
- O preço **é o mesmo para qualquer aroma**, só muda conforme o frasco.

**Planos futuros (fora do escopo por enquanto)**

- Pensam em fazer home spray e difusor de ambiente, mas ainda não levantaram os insumos.

## Decisões tomadas a partir das respostas

| Decisão | Por quê |
|---|---|
| Cada essência é um insumo próprio, em gramas | É assim que estocam e medem na produção |
| Uma ficha técnica por produto (42), não por modelo (3) | A tela de Produtos edita a ficha dentro do produto. Com fichas compartilhadas, editar uma alteraria as outras |
| Pavio = 0,5 por vela | Um pavio rende duas velas |
| Tampa não é insumo | Vem com o frasco de 90g |
| Adesivo da vela **na** ficha técnica | Vai colado na vela produzida (a confirmar, pergunta 7) |
| Sacola, caixa e adesivo da sacola **fora** da ficha, com baixa manual | São consumidos na venda, e o app só dá baixa automática na produção |
| Sem margem de perda na ficha | Perda é pequena, e eles pesam antes |

## Fontes complementares

**Landing page** (`laurea_prod/index.html`, versão de 2026-09-01, feita para o cliente):

| Modelo na landing | Tamanho | Frasco | Preço |
|---|---|---|---|
| Vela Clássica Liso | 90g | Vidro transparente liso | R$ 35,90 |
| Vela Recipiente Fosco | 200g | Vidro fosco jateado | R$ 65,90 |
| Vela Recipiente Refinado | 200g | Canelado refinado | R$ 75,90 |

- Os preços confirmam a resposta dele ("preço igual independente do aroma, só altera conforme o tipo de frasco") e foram usados no seed.
- A landing lista **10 fragrâncias**: Bergamota, Flor de Laranjeira, Flor de Figo, Canela, Bamboo, Cereja e Avelã, Vanilla, Café, Capim Limão e Alecrim, Lavanda. A resposta dele (09/09, mais recente) lista 14 essências. As diferenças são as perguntas 2 e 3.
