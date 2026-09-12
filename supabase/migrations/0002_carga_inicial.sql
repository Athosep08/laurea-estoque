-- L'AUREA Estoque — carga inicial: insumos, produtos e fichas técnicas.
--
-- Fonte: respostas do stakeholder em 2026-09-09, registradas em
-- docs/perguntas-stakeholder.md.
--
-- Como os dados estão modelados:
--   * Cada essência é um insumo próprio, com estoque em GRAMAS (é como a
--     produção mede: 10 g numa vela de 90 g, 20 g numa de 200 g).
--   * Produto = modelo × aroma (3 × 14 = 42 produtos), cada um com a SUA
--     ficha técnica. É o formato que a tela de Produtos já usa — a ficha é
--     editada dentro do produto, então não pode ser compartilhada entre
--     produtos (editar uma alteraria todas).
--   * Pavio entra como 0,5 por vela: ele é cortado no tamanho do frasco e
--     um pavio costuma render duas velas.
--   * O adesivo da vela entra na ficha (vai colado na vela produzida). Sacola,
--     caixa e adesivo da sacola são consumidos por VENDA, não por produção, e
--     o app só dá baixa automática na produção — ficam fora das fichas, com
--     baixa manual via ajuste.
--
-- IDs são derivados de md5 do nome, então rodar duas vezes não duplica nada.
--
-- O script aborta sem gravar nada se algum preço em `seed_modelos` estiver
-- zerado.

begin;

-- ---------------------------------------------------------------------------
-- Parâmetros — é aqui que se mexe
-- ---------------------------------------------------------------------------

create temp table seed_modelos (
  modelo text primary key,
  frasco text not null,
  cera_g numeric not null,
  essencia_g numeric not null,
  price_cents integer not null
) on commit drop;

-- Nomes e preços são os da landing page (laurea_prod/index.html), que é o
-- catálogo que o cliente vê e usa para pedir pelo WhatsApp. O stakeholder
-- chamou os modelos de "90", "200g liso" e "200g refinado"; aqui o
-- "200g liso" é o Recipiente Fosco.
-- Preço é o mesmo para qualquer aroma; só muda pelo frasco.
insert into seed_modelos values
  ('Clássica Liso 90g',        'Frasco 90g liso (com tampa)', 80,  10, 3590),
  ('Recipiente Fosco 200g',    'Frasco 200g fosco',           180, 20, 6590),
  ('Recipiente Refinado 200g', 'Frasco 200g canelado',        180, 20, 7590);

-- Estoque de essência em gramas, contado em 2026-09-09.
create temp table seed_aromas (
  aroma text primary key,
  estoque_g numeric not null
) on commit drop;

insert into seed_aromas values
  ('Café',               224),
  ('Apple Cake',         230),
  ('Lavanda',            300),
  ('Flor de Laranjeira',  34),
  ('Flor de Figo',       200),
  ('Bamboo',             120),
  ('Coco',               100),
  ('Cereja e Avelã',     260),
  ('Alecrim',             26),
  ('Capim Limão',          0),  -- TODO estoque não informado
  ('Bergamota',            0),  -- TODO estoque não informado
  ('Vanilla Prime',        0),  -- TODO estoque não informado
  ('Canela',               0),  -- TODO estoque não informado
  ('Santal',               0);  -- TODO estoque não informado

do $$
begin
  if exists (select 1 from seed_modelos where price_cents <= 0) then
    raise exception 'Preencha o preço de venda dos 3 modelos em seed_modelos antes de rodar este seed.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Limpa o rascunho anterior deste seed (IDs fixos c1000000-… / d1000000-…),
-- caso ele tenha sido rodado antes das respostas do stakeholder. Não faz nada
-- se nunca rodou, e não apaga insumo que já tenha movimentação.
-- ---------------------------------------------------------------------------

delete from recipes where id::text like 'd1000000-0000-4000-8000-00000000000_';

delete from supplies s
where s.id::text like 'c1000000-0000-4000-8000-00000000000_'
  and not exists (select 1 from recipe_items ri where ri.supply_id = s.id)
  and not exists (select 1 from consumed_supplies cs where cs.supply_id = s.id)
  and not exists (select 1 from movements m where m.supply_id = s.id);

-- ---------------------------------------------------------------------------
-- Insumos
-- ---------------------------------------------------------------------------

insert into supplies (id, name, unit, quantity, min_quantity)
select md5('laurea:supply:' || name)::uuid, name, unit, quantity, 0
from (
  values
    ('Cera de coco',      'g',  12000),
    ('Pavio',             'un', 0),  -- TODO estoque não informado
    ('Ilhós médio',       'un', 0),  -- TODO estoque não informado
    ('Adesivo da vela',   'un', 0),  -- TODO estoque não informado
    ('Adesivo da sacola', 'un', 0),  -- TODO estoque não informado
    ('Sacola',            'un', 0),  -- TODO estoque não informado
    ('Caixa',             'un', 0)   -- TODO estoque não informado
) as fixos (name, unit, quantity)
union all
-- TODO estoque dos frascos não informado
select md5('laurea:supply:' || frasco)::uuid, frasco, 'un', 0, 0 from seed_modelos
union all
select md5('laurea:supply:Essência ' || aroma)::uuid, 'Essência ' || aroma, 'g', estoque_g, 0
from seed_aromas
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Fichas técnicas — uma por produto
-- ---------------------------------------------------------------------------

insert into recipes (id, name)
select md5('laurea:recipe:' || m.modelo || ':' || a.aroma)::uuid,
       m.modelo || ' ' || a.aroma || ' — ficha técnica'
from seed_modelos m
cross join seed_aromas a
on conflict (id) do nothing;

insert into recipe_items (recipe_id, supply_id, quantity_per_unit)
select md5('laurea:recipe:' || m.modelo || ':' || a.aroma)::uuid,
       md5('laurea:supply:' || item.insumo)::uuid,
       item.quantidade
from seed_modelos m
cross join seed_aromas a
cross join lateral (
  values
    ('Cera de coco',         m.cera_g),
    ('Essência ' || a.aroma, m.essencia_g),
    ('Pavio',                0.5),
    ('Ilhós médio',          1),
    (m.frasco,               1),
    ('Adesivo da vela',      1)
) as item (insumo, quantidade)
on conflict (recipe_id, supply_id) do nothing;

-- ---------------------------------------------------------------------------
-- Produtos — estoque de vela pronta começa em 0 (não informado)
-- ---------------------------------------------------------------------------

insert into products (id, model, scent, price_cents, quantity, min_quantity, recipe_id, active)
select md5('laurea:product:' || m.modelo || ':' || a.aroma)::uuid,
       m.modelo,
       a.aroma,
       m.price_cents,
       0,
       0,
       md5('laurea:recipe:' || m.modelo || ':' || a.aroma)::uuid,
       true
from seed_modelos m
cross join seed_aromas a
on conflict (id) do nothing;

commit;
