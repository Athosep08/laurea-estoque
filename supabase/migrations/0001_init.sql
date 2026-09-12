-- L'AUREA Estoque — schema inicial + proteção de concorrência via RPC.
--
-- Login é compartilhado (uma única conta Supabase Auth para o casal), então
-- as políticas de RLS liberam acesso total para qualquer usuário autenticado
-- e negam tudo para `anon`. Não há conceito de "dono do dado" — a conta é o
-- perímetro de segurança.
--
-- Mutações de estoque (venda, produção, compra de insumo, ajuste, desfazer)
-- NÃO são feitas por UPDATE direto do cliente: são funções (RPC) que fazem
-- `select ... for update` (trava a linha) antes de validar e escrever, dentro
-- de uma única transação. Isso é o que impede estoque negativo quando dois
-- aparelhos vendem a mesma vela ao mesmo tempo.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists supplies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('kg', 'g', 'L', 'ml', 'un')),
  quantity numeric not null default 0,
  min_quantity numeric not null default 0 check (min_quantity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists recipe_items (
  recipe_id uuid not null references recipes (id) on delete cascade,
  supply_id uuid not null references supplies (id) on delete restrict,
  quantity_per_unit numeric not null check (quantity_per_unit > 0),
  primary key (recipe_id, supply_id)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  scent text not null,
  price_cents integer not null check (price_cents >= 0),
  quantity integer not null default 0,
  min_quantity integer not null default 0 check (min_quantity >= 0),
  recipe_id uuid references recipes (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('production', 'sale', 'adjustment', 'supply_purchase')),
  occurred_at timestamptz not null default now(),
  product_id uuid references products (id) on delete set null,
  supply_id uuid references supplies (id) on delete set null,
  quantity numeric not null,
  total_cents integer,
  note text,
  undone boolean not null default false
);

create table if not exists consumed_supplies (
  movement_id uuid not null references movements (id) on delete cascade,
  supply_id uuid not null references supplies (id) on delete restrict,
  quantity numeric not null,
  primary key (movement_id, supply_id)
);

create index if not exists movements_occurred_at_idx on movements (occurred_at desc);
create index if not exists movements_product_id_idx on movements (product_id);
create index if not exists movements_supply_id_idx on movements (supply_id);

-- Observação: `quantity` de products/supplies NÃO tem `check (quantity >= 0)`
-- de propósito. A validação de "não pode ficar negativo" é feita dentro das
-- funções abaixo, ANTES de escrever, para poder devolver um erro estruturado
-- (`negative_result`) em vez de um erro genérico de constraint do Postgres.

-- ---------------------------------------------------------------------------
-- RLS — login compartilhado, sem conceito de dono da linha
-- ---------------------------------------------------------------------------

alter table recipes enable row level security;
alter table recipe_items enable row level security;
alter table supplies enable row level security;
alter table products enable row level security;
alter table movements enable row level security;
alter table consumed_supplies enable row level security;

drop policy if exists "authenticated_all" on recipes;
drop policy if exists "authenticated_all" on recipe_items;
drop policy if exists "authenticated_all" on supplies;
drop policy if exists "authenticated_all" on products;
drop policy if exists "authenticated_all" on movements;
drop policy if exists "authenticated_all" on consumed_supplies;

create policy "authenticated_all" on recipes for all to authenticated using (true) with check (true);
create policy "authenticated_all" on recipe_items for all to authenticated using (true) with check (true);
create policy "authenticated_all" on supplies for all to authenticated using (true) with check (true);
create policy "authenticated_all" on products for all to authenticated using (true) with check (true);
create policy "authenticated_all" on movements for all to authenticated using (true) with check (true);
create policy "authenticated_all" on consumed_supplies for all to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  recipes, recipe_items, supplies, products, movements, consumed_supplies
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: register_sale
-- ---------------------------------------------------------------------------

create or replace function register_sale(
  p_product_id uuid,
  p_quantity integer,
  p_total_cents integer default null,
  p_note text default null
)
returns movements
language plpgsql
as $$
declare
  v_quantity int;
  v_price_cents int;
  v_movement movements;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception '%', json_build_object('reason', 'invalid_quantity');
  end if;

  select quantity, price_cents into v_quantity, v_price_cents
  from products where id = p_product_id for update;

  if not found then
    raise exception '%', json_build_object('reason', 'product_not_found');
  end if;

  if v_quantity < p_quantity then
    raise exception '%', json_build_object(
      'reason', 'insufficient_stock', 'available', v_quantity, 'requested', p_quantity
    );
  end if;

  update products set quantity = quantity - p_quantity where id = p_product_id;

  insert into movements (type, product_id, quantity, total_cents, note)
  values ('sale', p_product_id, p_quantity, coalesce(p_total_cents, v_price_cents * p_quantity), p_note)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function register_sale(uuid, integer, integer, text) from public;
grant execute on function register_sale(uuid, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: register_production
-- ---------------------------------------------------------------------------

create or replace function register_production(
  p_product_id uuid,
  p_quantity integer,
  p_note text default null
)
returns movements
language plpgsql
as $$
declare
  v_recipe_id uuid;
  v_movement movements;
  v_missing jsonb := '[]'::jsonb;
  v_consumed jsonb := '[]'::jsonb;
  v_item record;
  v_required numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception '%', json_build_object('reason', 'invalid_quantity');
  end if;

  select recipe_id into v_recipe_id from products where id = p_product_id for update;
  if not found then
    raise exception '%', json_build_object('reason', 'product_not_found');
  end if;

  if v_recipe_id is null then
    update products set quantity = quantity + p_quantity where id = p_product_id;

    insert into movements (type, product_id, quantity, note)
    values ('production', p_product_id, p_quantity, p_note)
    returning * into v_movement;

    return v_movement;
  end if;

  for v_item in
    select ri.supply_id, ri.quantity_per_unit, s.quantity as available
    from recipe_items ri
    join supplies s on s.id = ri.supply_id
    where ri.recipe_id = v_recipe_id
    order by ri.supply_id
    for update of s
  loop
    v_required := round(v_item.quantity_per_unit * p_quantity, 6);
    if v_item.available < v_required then
      v_missing := v_missing || jsonb_build_object(
        'supplyId', v_item.supply_id, 'required', v_required, 'available', v_item.available
      );
    end if;
    v_consumed := v_consumed || jsonb_build_object('supplyId', v_item.supply_id, 'quantity', v_required);
  end loop;

  if jsonb_array_length(v_missing) > 0 then
    raise exception '%', json_build_object('reason', 'missing_supplies', 'missing', v_missing);
  end if;

  update products set quantity = quantity + p_quantity where id = p_product_id;

  update supplies s
  set quantity = round(s.quantity - (c ->> 'quantity')::numeric, 6)
  from jsonb_array_elements(v_consumed) c
  where s.id = (c ->> 'supplyId')::uuid;

  insert into movements (type, product_id, quantity, note)
  values ('production', p_product_id, p_quantity, p_note)
  returning * into v_movement;

  insert into consumed_supplies (movement_id, supply_id, quantity)
  select v_movement.id, (c ->> 'supplyId')::uuid, (c ->> 'quantity')::numeric
  from jsonb_array_elements(v_consumed) c;

  return v_movement;
end;
$$;

revoke all on function register_production(uuid, integer, text) from public;
grant execute on function register_production(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: register_supply_purchase
-- ---------------------------------------------------------------------------

create or replace function register_supply_purchase(
  p_supply_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns movements
language plpgsql
as $$
declare
  v_movement movements;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception '%', json_build_object('reason', 'invalid_quantity');
  end if;

  update supplies set quantity = round(quantity + p_quantity, 6) where id = p_supply_id;

  if not found then
    raise exception '%', json_build_object('reason', 'supply_not_found');
  end if;

  insert into movements (type, supply_id, quantity, note)
  values ('supply_purchase', p_supply_id, p_quantity, p_note)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function register_supply_purchase(uuid, numeric, text) from public;
grant execute on function register_supply_purchase(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: adjust_stock
-- ---------------------------------------------------------------------------

create or replace function adjust_stock(
  p_target text,
  p_id uuid,
  p_delta numeric,
  p_note text
)
returns movements
language plpgsql
as $$
declare
  v_movement movements;
  v_current numeric;
  v_resulting numeric;
begin
  if p_note is null or btrim(p_note) = '' then
    raise exception '%', json_build_object('reason', 'note_required');
  end if;

  if p_target = 'product' then
    select quantity into v_current from products where id = p_id for update;
    if not found then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    v_resulting := v_current + p_delta;
    if v_resulting < 0 then
      raise exception '%', json_build_object('reason', 'negative_result', 'resulting', v_resulting);
    end if;

    update products set quantity = v_resulting where id = p_id;

    insert into movements (type, product_id, quantity, note)
    values ('adjustment', p_id, p_delta, p_note)
    returning * into v_movement;

  elsif p_target = 'supply' then
    select quantity into v_current from supplies where id = p_id for update;
    if not found then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    v_resulting := round(v_current + p_delta, 6);
    if v_resulting < 0 then
      raise exception '%', json_build_object('reason', 'negative_result', 'resulting', v_resulting);
    end if;

    update supplies set quantity = v_resulting where id = p_id;

    insert into movements (type, supply_id, quantity, note)
    values ('adjustment', p_id, p_delta, p_note)
    returning * into v_movement;
  else
    raise exception '%', json_build_object('reason', 'invalid_target');
  end if;

  return v_movement;
end;
$$;

revoke all on function adjust_stock(text, uuid, numeric, text) from public;
grant execute on function adjust_stock(text, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: undo_movement
-- ---------------------------------------------------------------------------

create or replace function undo_movement(p_movement_id uuid)
returns movements
language plpgsql
as $$
declare
  v_movement movements;
  v_resulting numeric;
  v_item record;
begin
  select * into v_movement from movements where id = p_movement_id for update;
  if not found then
    raise exception '%', json_build_object('reason', 'not_found');
  end if;
  if v_movement.undone then
    raise exception '%', json_build_object('reason', 'already_undone');
  end if;

  if v_movement.type = 'sale' then
    if v_movement.product_id is null then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    update products set quantity = quantity + v_movement.quantity where id = v_movement.product_id;
    if not found then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

  elsif v_movement.type = 'production' then
    if v_movement.product_id is null then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    select quantity into v_resulting from products where id = v_movement.product_id for update;
    if not found then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    v_resulting := v_resulting - v_movement.quantity;
    if v_resulting < 0 then
      raise exception '%', json_build_object('reason', 'negative_result', 'resulting', v_resulting);
    end if;

    update products set quantity = v_resulting where id = v_movement.product_id;

    for v_item in
      select supply_id, quantity from consumed_supplies where movement_id = v_movement.id
    loop
      update supplies set quantity = round(quantity + v_item.quantity, 6) where id = v_item.supply_id;
    end loop;

  elsif v_movement.type = 'supply_purchase' then
    if v_movement.supply_id is null then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    select quantity into v_resulting from supplies where id = v_movement.supply_id for update;
    if not found then
      raise exception '%', json_build_object('reason', 'not_found');
    end if;

    v_resulting := round(v_resulting - v_movement.quantity, 6);
    if v_resulting < 0 then
      raise exception '%', json_build_object('reason', 'negative_result', 'resulting', v_resulting);
    end if;

    update supplies set quantity = v_resulting where id = v_movement.supply_id;

  elsif v_movement.type = 'adjustment' then
    if v_movement.product_id is not null then
      select quantity into v_resulting from products where id = v_movement.product_id for update;
      if not found then
        raise exception '%', json_build_object('reason', 'not_found');
      end if;

      v_resulting := v_resulting - v_movement.quantity;
      if v_resulting < 0 then
        raise exception '%', json_build_object('reason', 'negative_result', 'resulting', v_resulting);
      end if;

      update products set quantity = v_resulting where id = v_movement.product_id;

    elsif v_movement.supply_id is not null then
      select quantity into v_resulting from supplies where id = v_movement.supply_id for update;
      if not found then
        raise exception '%', json_build_object('reason', 'not_found');
      end if;

      v_resulting := round(v_resulting - v_movement.quantity, 6);
      if v_resulting < 0 then
        raise exception '%', json_build_object('reason', 'negative_result', 'resulting', v_resulting);
      end if;

      update supplies set quantity = v_resulting where id = v_movement.supply_id;
    else
      raise exception '%', json_build_object('reason', 'not_found');
    end if;
  end if;

  update movements set undone = true where id = v_movement.id
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function undo_movement(uuid) from public;
grant execute on function undo_movement(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: replace_state / erase_all (usadas pela tela de Backup)
-- ---------------------------------------------------------------------------

create or replace function replace_state(p_state jsonb)
returns void
language plpgsql
as $$
begin
  delete from consumed_supplies;
  delete from movements;
  delete from recipe_items;
  delete from products;
  delete from supplies;
  delete from recipes;

  insert into recipes (id, name)
  select (r ->> 'id')::uuid, r ->> 'name'
  from jsonb_array_elements(coalesce(p_state -> 'recipes', '[]'::jsonb)) r;

  insert into recipe_items (recipe_id, supply_id, quantity_per_unit)
  select (r ->> 'id')::uuid, (i ->> 'supplyId')::uuid, (i ->> 'quantityPerUnit')::numeric
  from jsonb_array_elements(coalesce(p_state -> 'recipes', '[]'::jsonb)) r,
       jsonb_array_elements(coalesce(r -> 'items', '[]'::jsonb)) i;

  insert into supplies (id, name, unit, quantity, min_quantity, created_at)
  select (s ->> 'id')::uuid, s ->> 'name', s ->> 'unit',
         (s ->> 'quantity')::numeric, (s ->> 'minQuantity')::numeric, (s ->> 'createdAt')::timestamptz
  from jsonb_array_elements(coalesce(p_state -> 'supplies', '[]'::jsonb)) s;

  insert into products (id, model, scent, price_cents, quantity, min_quantity, recipe_id, active, created_at)
  select (p ->> 'id')::uuid, p ->> 'model', p ->> 'scent', (p ->> 'priceCents')::integer,
         (p ->> 'quantity')::integer, (p ->> 'minQuantity')::integer,
         nullif(p ->> 'recipeId', '')::uuid, (p ->> 'active')::boolean, (p ->> 'createdAt')::timestamptz
  from jsonb_array_elements(coalesce(p_state -> 'products', '[]'::jsonb)) p;

  insert into movements (id, type, occurred_at, product_id, supply_id, quantity, total_cents, note, undone)
  select (m ->> 'id')::uuid, m ->> 'type', (m ->> 'occurredAt')::timestamptz,
         nullif(m ->> 'productId', '')::uuid, nullif(m ->> 'supplyId', '')::uuid,
         (m ->> 'quantity')::numeric, (m ->> 'totalCents')::integer, m ->> 'note', (m ->> 'undone')::boolean
  from jsonb_array_elements(coalesce(p_state -> 'movements', '[]'::jsonb)) m;

  insert into consumed_supplies (movement_id, supply_id, quantity)
  select (m ->> 'id')::uuid, (c ->> 'supplyId')::uuid, (c ->> 'quantity')::numeric
  from jsonb_array_elements(coalesce(p_state -> 'movements', '[]'::jsonb)) m,
       jsonb_array_elements(coalesce(m -> 'consumed', '[]'::jsonb)) c;
end;
$$;

revoke all on function replace_state(jsonb) from public;
grant execute on function replace_state(jsonb) to authenticated;

create or replace function erase_all()
returns void
language plpgsql
as $$
begin
  delete from consumed_supplies;
  delete from movements;
  delete from recipe_items;
  delete from products;
  delete from supplies;
  delete from recipes;
end;
$$;

revoke all on function erase_all() from public;
grant execute on function erase_all() to authenticated;
