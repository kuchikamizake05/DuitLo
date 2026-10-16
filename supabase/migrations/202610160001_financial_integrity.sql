begin;

-- A committed request remains acknowledgeable after the goal is archived.
create or replace function public.deposit_to_financial_goal(p_request_id uuid,p_goal_id uuid,p_account_id uuid,p_amount numeric)
returns public.financial_goals language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.financial_goals; a public.financial_accounts; existing public.financial_goal_deposits;
begin
 if auth.uid() is null or p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid deposit'; end if;
 select * into g from financial_goals where id=p_goal_id and user_id=auth.uid() for update;
 if not found then raise exception 'Goal unavailable'; end if;
 select * into existing from financial_goal_deposits where id=p_request_id;
 if found then
  if existing.user_id<>auth.uid() or existing.goal_id<>p_goal_id or existing.account_id<>p_account_id or existing.amount<>p_amount then raise exception 'Request conflict'; end if;
  return g;
 end if;
 if not g.is_active then raise exception 'Goal unavailable'; end if;
 select * into a from financial_accounts where id=p_account_id and user_id=auth.uid() for update;
 if not found or not a.is_active or a.currency<>g.currency or a.kind='liability' then raise exception 'Source account unavailable'; end if;
 if a.current_balance<p_amount then raise exception 'Insufficient balance'; end if;
 insert into financial_goal_deposits(id,user_id,goal_id,account_id,amount,currency) values(p_request_id,auth.uid(),g.id,a.id,p_amount,g.currency);
 perform apply_account_delta(a.id,-p_amount);
 update financial_goals set current_amount=current_amount+p_amount where id=g.id returning * into g;
 return g;
end $$;

-- Invoker rights distinguish direct PostgREST writes from the trusted deposit RPC.
create function public.guard_goal_ledger_amount()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.current_amount is distinct from 0::numeric then
      raise exception 'New goals must start at zero; use deposit_to_financial_goal'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if current_user in ('anon', 'authenticated')
     and new.current_amount is distinct from old.current_amount then
    raise exception 'Use deposit_to_financial_goal to change saved amount'
      using errcode = '42501';
  end if;
  if new.currency is distinct from old.currency
     and (old.current_amount > 0 or exists (
       select 1 from public.financial_goal_deposits where goal_id = old.id
     )) then
    raise exception 'Goal currency cannot change after savings or deposits exist'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_goal_ledger_amount
  before insert or update on public.financial_goals
  for each row execute function public.guard_goal_ledger_amount();

create function public.guard_wallet_deletion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.current_balance <> 0 then
    raise exception 'Account balance must be zero before deletion' using errcode = '23514';
  end if;
  if exists(select 1 from transactions where account_id = old.id)
     or exists(select 1 from account_transfers where source_account_id = old.id or destination_account_id = old.id)
     or exists(select 1 from recurring_transactions where account_id = old.id)
     or exists(select 1 from account_reconciliations where account_id = old.id)
     or exists(select 1 from stock_executions where account_id = old.id)
     or exists(select 1 from forex_trades where account_id = old.id)
     or exists(select 1 from account_equity_snapshots where account_id = old.id)
     or exists(select 1 from financial_goal_deposits where account_id = old.id) then
    raise exception 'Account has financial history; archive it instead' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger guard_wallet_deletion
  before delete on public.financial_accounts
  for each row execute function public.guard_wallet_deletion();

revoke all on function public.guard_goal_ledger_amount() from public, anon, authenticated;
revoke all on function public.guard_wallet_deletion() from public, anon, authenticated;
commit;
