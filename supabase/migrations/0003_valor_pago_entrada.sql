-- L'AUREA Estoque — valor pago na entrada de insumo.
--
-- Até aqui a entrada de insumo registrava só a quantidade (chegaram 1.000 g
-- de cera), sem quanto custou. Sem isso, o relatório de gastos não tem de
-- onde tirar os números.
--
-- Não precisa de coluna nova: `movements.total_cents` já existe e só era
-- usada em vendas. O relatório de faturamento soma apenas movimentos do tipo
-- 'sale', então gravar ali o valor pago de uma 'supply_purchase' não mistura
-- gasto com receita.
--
-- O valor é opcional (brinde, ou valor desconhecido) e só vale daqui para
-- frente: entradas antigas continuam sem valor.
--
-- ORDEM DE DEPLOY: rode esta migration ANTES de publicar o front que manda
-- `p_total_cents`. O front antigo continua funcionando depois dela, porque o
-- parâmetro novo tem valor padrão.

-- A assinatura muda (ganha um parâmetro), então a função antiga sai primeiro;
-- senão as duas versões conviveriam e a chamada ficaria ambígua.
drop function if exists register_supply_purchase(uuid, numeric, text);

create or replace function register_supply_purchase(
  p_supply_id uuid,
  p_quantity numeric,
  p_note text default null,
  p_total_cents integer default null
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

  if p_total_cents is not null and p_total_cents < 0 then
    raise exception '%', json_build_object('reason', 'invalid_total');
  end if;

  update supplies set quantity = round(quantity + p_quantity, 6) where id = p_supply_id;

  if not found then
    raise exception '%', json_build_object('reason', 'supply_not_found');
  end if;

  insert into movements (type, supply_id, quantity, total_cents, note)
  values ('supply_purchase', p_supply_id, p_quantity, p_total_cents, p_note)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function register_supply_purchase(uuid, numeric, text, integer) from public;
grant execute on function register_supply_purchase(uuid, numeric, text, integer) to authenticated;
