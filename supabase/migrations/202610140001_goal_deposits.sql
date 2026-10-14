begin;
create table public.financial_goal_deposits (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null references public.financial_goals(id) on delete restrict,
 account_id uuid not null references public.financial_accounts(id) on delete restrict,
 amount numeric not null check(amount>0),
 currency text not null,
 created_at timestamptz not null default now()
);
alter table public.financial_goal_deposits enable row level security;
create policy "Read own goal deposits" on public.financial_goal_deposits for select to authenticated using(user_id=auth.uid());
revoke all on public.financial_goal_deposits from anon,authenticated;
grant select on public.financial_goal_deposits to authenticated;
create function public.deposit_to_financial_goal(p_request_id uuid,p_goal_id uuid,p_account_id uuid,p_amount numeric)
returns public.financial_goals language plpgsql security definer set search_path=public as $$
declare g public.financial_goals; a public.financial_accounts; existing public.financial_goal_deposits;
begin
 if auth.uid() is null or p_amount is null or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid deposit'; end if;
 select * into g from financial_goals where id=p_goal_id and user_id=auth.uid() for update;
 if not found or not g.is_active then raise exception 'Goal unavailable'; end if;
 select * into existing from financial_goal_deposits where id=p_request_id;
 if found then
  if existing.user_id<>auth.uid() or existing.goal_id<>p_goal_id or existing.account_id<>p_account_id or existing.amount<>p_amount then raise exception 'Request conflict'; end if;
  return g;
 end if;
 select * into a from financial_accounts where id=p_account_id and user_id=auth.uid() for update;
 if not found or not a.is_active or a.currency<>g.currency or a.kind='liability' then raise exception 'Source account unavailable'; end if;
 if a.current_balance<p_amount then raise exception 'Insufficient balance'; end if;
 insert into financial_goal_deposits(id,user_id,goal_id,account_id,amount,currency) values(p_request_id,auth.uid(),g.id,a.id,p_amount,g.currency);
 perform apply_account_delta(a.id,-p_amount);
 update financial_goals set current_amount=current_amount+p_amount where id=g.id returning * into g;
 return g;
end $$;
revoke all on function public.deposit_to_financial_goal(uuid,uuid,uuid,numeric) from public,anon;
grant execute on function public.deposit_to_financial_goal(uuid,uuid,uuid,numeric) to authenticated;
commit;
