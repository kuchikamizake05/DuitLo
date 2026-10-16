begin;

create table public.billing_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false
);
insert into public.billing_settings(id,enabled) values(true,false);
create table public.billing_subscriptions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 pro_until timestamptz not null,
 updated_at timestamptz not null default now()
);
create table public.billing_checkout_operations (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 external_id text unique not null,
 invoice_id text unique,
 invoice_url text,
 amount bigint not null check(amount>0),
 currency text not null check(currency='IDR'),
 term_days integer not null check(term_days between 1 and 366),
 status text not null default 'pending' check(status in ('pending','paid','expired')),
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index billing_checkout_owner_idx on public.billing_checkout_operations(user_id,created_at desc);
create table public.billing_usage_operations (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 month date not null,
 metric text not null check(metric='receipt_scan'),
 status text not null default 'reserved' check(status in ('reserved','succeeded','refunded')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index billing_usage_owner_month_idx on public.billing_usage_operations(user_id,month,metric,status);
create table public.billing_usage_reconciliations (
 operation_id uuid primary key references public.billing_usage_operations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 20 and 1000),
 reconciled_by text not null,
 reconciled_at timestamptz not null default now()
);

alter table public.billing_settings enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_checkout_operations enable row level security;
alter table public.billing_usage_operations enable row level security;
alter table public.billing_usage_reconciliations enable row level security;
revoke all on public.billing_settings, public.billing_subscriptions, public.billing_checkout_operations, public.billing_usage_operations from public,anon,authenticated;
grant select on public.billing_subscriptions,public.billing_checkout_operations,public.billing_usage_operations to authenticated;
grant all on public.billing_settings,public.billing_subscriptions,public.billing_checkout_operations,public.billing_usage_operations to service_role;
revoke all on public.billing_usage_reconciliations from public,anon,authenticated;
grant select on public.billing_usage_reconciliations to service_role;
create policy "Read own billing subscription" on public.billing_subscriptions for select to authenticated using(user_id=auth.uid());
create policy "Read own checkout operations" on public.billing_checkout_operations for select to authenticated using(user_id=auth.uid());
create policy "Read own usage operations" on public.billing_usage_operations for select to authenticated using(user_id=auth.uid());

create function public.billing_is_pro(p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.billing_subscriptions where user_id=p_user_id and pro_until>now())
$$;

create function public.billing_claim_checkout(p_user_id uuid,p_operation_id uuid,p_amount bigint,p_currency text,p_term_days integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.billing_checkout_operations;
begin
 if not coalesce((select enabled from public.billing_settings where id=true),false) then raise exception 'Billing disabled' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into operation from public.billing_checkout_operations where id=p_operation_id for update;
 if found then
  if operation.user_id<>p_user_id then raise exception 'Checkout owner mismatch' using errcode='23514'; end if;
  return jsonb_build_object('created',false,'operation',to_jsonb(operation));
 end if;
 -- A changed browser key cannot create a second concurrent/uncertain charge.
 select * into operation from public.billing_checkout_operations where user_id=p_user_id and status='pending' order by created_at desc limit 1 for update;
 if found then return jsonb_build_object('created',false,'operation',to_jsonb(operation)); end if;
 insert into public.billing_checkout_operations(id,user_id,external_id,amount,currency,term_days)
 values(p_operation_id,p_user_id,'fintrack-'||p_operation_id,p_amount,p_currency,p_term_days) returning * into operation;
 return jsonb_build_object('created',true,'operation',to_jsonb(operation));
end $$;

create function public.billing_bind_invoice(p_operation_id uuid,p_invoice_id text,p_invoice_url text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.billing_checkout_operations;
begin
 select * into operation from public.billing_checkout_operations where id=p_operation_id for update;
 if not found or p_invoice_id is null or p_invoice_url is null then raise exception 'Checkout unavailable' using errcode='23514'; end if;
 if operation.invoice_id is not null and (operation.invoice_id<>p_invoice_id or operation.invoice_url<>p_invoice_url) then raise exception 'Checkout binding conflict' using errcode='23514'; end if;
 update public.billing_checkout_operations set invoice_id=p_invoice_id,invoice_url=p_invoice_url where id=p_operation_id;
end $$;

create function public.billing_settle_invoice(p_invoice_id text,p_external_id text,p_amount bigint,p_currency text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.billing_checkout_operations; expiry timestamptz;
begin
 select * into operation from public.billing_checkout_operations where invoice_id=p_invoice_id;
 if not found then raise exception 'Checkout not bound' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(operation.user_id::text,0));
 select * into operation from public.billing_checkout_operations where id=operation.id for update;
 if operation.external_id<>p_external_id or operation.amount<>p_amount or operation.currency<>p_currency then raise exception 'Payment mismatch' using errcode='23514'; end if;
 if operation.status='paid' then return jsonb_build_object('replayed',true); end if;
 select pro_until into expiry from public.billing_subscriptions where user_id=operation.user_id for update;
 expiry:=greatest(now(),coalesce(expiry,now()))+make_interval(days=>operation.term_days);
 insert into public.billing_subscriptions(user_id,pro_until) values(operation.user_id,expiry)
 on conflict(user_id) do update set pro_until=excluded.pro_until,updated_at=now();
 update public.billing_checkout_operations set status='paid',paid_at=now() where id=operation.id;
 return jsonb_build_object('replayed',false,'pro_until',expiry);
end $$;

create function public.billing_expire_checkout(p_operation_id uuid,p_invoice_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.billing_checkout_operations set status='expired' where id=p_operation_id and invoice_id=p_invoice_id and status='pending';
end $$;

create function public.billing_reserve_usage(p_user_id uuid,p_operation_id uuid,p_metric text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.billing_usage_operations; allowance integer; used integer; period date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 if not coalesce((select enabled from public.billing_settings where id=true),false) then raise exception 'Billing disabled' using errcode='23514'; end if;
 if p_metric<>'receipt_scan' or p_metric is null then raise exception 'Invalid usage metric' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into operation from public.billing_usage_operations where id=p_operation_id for update;
 if found then
  if operation.user_id<>p_user_id or operation.metric<>p_metric then raise exception 'Usage owner mismatch' using errcode='23514'; end if;
  return jsonb_build_object('reserved',false,'replayed',true);
 end if;
 allowance:=case when public.billing_is_pro(p_user_id) then 150 else 15 end;
 select count(*) into used from public.billing_usage_operations where user_id=p_user_id and month=period and metric=p_metric and status in ('reserved','succeeded');
 if used>=allowance then raise exception 'Receipt scan quota reached' using errcode='23514'; end if;
 insert into public.billing_usage_operations(id,user_id,month,metric) values(p_operation_id,p_user_id,period,p_metric);
 return jsonb_build_object('reserved',true,'replayed',false);
end $$;

create function public.billing_finish_usage(p_user_id uuid,p_operation_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 update public.billing_usage_operations set status=case when p_success then 'succeeded' else 'refunded' end,updated_at=now()
 where id=p_operation_id and user_id=p_user_id and status='reserved';
end $$;

create function public.billing_assert_investment_write(p_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce((select enabled from public.billing_settings where id=true),false) and not public.billing_is_pro(p_user_id) then
  raise exception 'Pro required for investment and trading writes' using errcode='23514';
 end if;
end $$;

create function public.billing_reconcile_abandoned_usage(p_user_id uuid,p_operation_id uuid,p_verified_failure boolean,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.billing_usage_operations;
begin
 if p_verified_failure is distinct from true or p_reason is null or char_length(btrim(p_reason)) not between 20 and 1000 then
  raise exception 'Verified failure evidence is required' using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into operation from public.billing_usage_operations where id=p_operation_id and user_id=p_user_id for update;
 if not found then raise exception 'Usage operation unavailable' using errcode='23514'; end if;
 if operation.status='refunded' then return false; end if;
 if operation.status<>'reserved' or operation.created_at>now()-interval '24 hours' then
  raise exception 'Only verified abandoned reservations older than24hours may be reconciled' using errcode='23514';
 end if;
 insert into public.billing_usage_reconciliations(operation_id,user_id,reason,reconciled_by)
 values(operation.id,operation.user_id,btrim(p_reason),session_user);
 update public.billing_usage_operations set status='refunded',updated_at=now() where id=operation.id;
 return true;
end $$;

create function public.billing_enforce_linked_investment_writes() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare old_row jsonb; new_row jsonb; owner_id uuid; linked_accounts uuid[];
begin
 if tg_op<>'INSERT' then old_row:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then new_row:=to_jsonb(new); end if;
 if not coalesce((select enabled from public.billing_settings where id=true),false) then
  if tg_op='DELETE' then return old; end if; return new;
 end if;
 owner_id:=coalesce((new_row->>'user_id')::uuid,(old_row->>'user_id')::uuid);
 if not public.billing_is_pro(owner_id) then
  linked_accounts:=array[(old_row->>'account_id')::uuid,(new_row->>'account_id')::uuid,
   (old_row->>'source_account_id')::uuid,(new_row->>'source_account_id')::uuid,
   (old_row->>'destination_account_id')::uuid,(new_row->>'destination_account_id')::uuid];
  if exists(select 1 from public.financial_accounts where user_id=owner_id and id=any(linked_accounts) and kind in ('investment','trading')) then
   raise exception 'Pro required for investment and trading account writes' using errcode='23514';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create function public.billing_enforce_limits() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid; existing integer;
begin
 if not coalesce((select enabled from public.billing_settings where id=true),false) then
  if tg_op='DELETE' then return old; end if; return new;
 end if;
 owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if public.billing_is_pro(owner_id) then if tg_op='DELETE' then return old; end if; return new; end if;
 if tg_table_name in ('stock_executions','forex_trades','ai_trade_reviews') then raise exception 'Pro required for investment and trading writes' using errcode='23514'; end if;
 if tg_table_name='financial_accounts' then
  if tg_op='DELETE' then
   if old.kind in ('investment','trading') then raise exception 'Pro required for investment and trading account writes' using errcode='23514'; end if;
   return old;
  end if;
  if new.kind in ('investment','trading') then raise exception 'Pro required for investment and trading account writes' using errcode='23514'; end if;
  if tg_op='UPDATE' then
   if old.kind in ('investment','trading') then raise exception 'Pro required for investment and trading account writes' using errcode='23514'; end if;
  end if;
  if not new.is_active then return new; end if;
  if tg_op='UPDATE' then if old.is_active and old.user_id=new.user_id then return new; end if; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if public.billing_is_pro(owner_id) then return new; end if;
  select count(*) into existing from public.financial_accounts where user_id=owner_id and is_active and id<>new.id;
  if existing>=3 then raise exception 'Free wallet limit reached' using errcode='23514'; end if;
 elsif tg_table_name='financial_goals' then
  if not new.is_active then return new; end if;
  if tg_op='UPDATE' then if old.is_active and old.user_id=new.user_id then return new; end if; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if public.billing_is_pro(owner_id) then return new; end if;
  select count(*) into existing from public.financial_goals where user_id=owner_id and is_active and id<>new.id;
  if existing>=1 then raise exception 'Free goal limit reached' using errcode='23514'; end if;
 elsif tg_table_name='financial_budgets' then
  if tg_op='UPDATE' then if old.month=new.month and old.user_id=new.user_id then return new; end if; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if public.billing_is_pro(owner_id) then return new; end if;
  select count(*) into existing from public.financial_budgets where user_id=owner_id and month=new.month and id<>new.id;
  if existing>=3 then raise exception 'Free monthly budget limit reached' using errcode='23514'; end if;
 end if;
 return new;
end $$;

create trigger billing_wallet_limit before insert or update or delete on public.financial_accounts for each row execute function public.billing_enforce_limits();
create trigger billing_goal_limit before insert or update on public.financial_goals for each row execute function public.billing_enforce_limits();
create trigger billing_budget_limit before insert or update on public.financial_budgets for each row execute function public.billing_enforce_limits();
create trigger billing_investment_gate before insert or update or delete on public.stock_executions for each row execute function public.billing_enforce_limits();
create trigger billing_trading_gate before insert or update or delete on public.forex_trades for each row execute function public.billing_enforce_limits();
create trigger billing_trade_review_gate before insert or update or delete on public.ai_trade_reviews for each row execute function public.billing_enforce_limits();
create trigger billing_transaction_investment_gate before insert or update or delete on public.transactions for each row execute function public.billing_enforce_linked_investment_writes();
create trigger billing_transfer_investment_gate before insert or update or delete on public.account_transfers for each row execute function public.billing_enforce_linked_investment_writes();
create trigger billing_recurring_investment_gate before insert or update or delete on public.recurring_transactions for each row execute function public.billing_enforce_linked_investment_writes();
create trigger billing_reconciliation_investment_gate before insert or update or delete on public.account_reconciliations for each row execute function public.billing_enforce_linked_investment_writes();
create trigger billing_snapshot_investment_gate before insert or update or delete on public.account_equity_snapshots for each row execute function public.billing_enforce_linked_investment_writes();
create trigger billing_goal_deposit_investment_gate before insert or update or delete on public.financial_goal_deposits for each row execute function public.billing_enforce_linked_investment_writes();

revoke all on function public.billing_is_pro(uuid),public.billing_claim_checkout(uuid,uuid,bigint,text,integer),public.billing_bind_invoice(uuid,text,text),public.billing_settle_invoice(text,text,bigint,text),public.billing_expire_checkout(uuid,text),public.billing_reserve_usage(uuid,uuid,text),public.billing_finish_usage(uuid,uuid,boolean),public.billing_assert_investment_write(uuid),public.billing_enforce_limits() from public,anon,authenticated;
grant execute on function public.billing_is_pro(uuid),public.billing_claim_checkout(uuid,uuid,bigint,text,integer),public.billing_bind_invoice(uuid,text,text),public.billing_settle_invoice(text,text,bigint,text),public.billing_expire_checkout(uuid,text),public.billing_reserve_usage(uuid,uuid,text),public.billing_finish_usage(uuid,uuid,boolean),public.billing_assert_investment_write(uuid) to service_role;
revoke all on function public.billing_enforce_linked_investment_writes(),public.billing_reconcile_abandoned_usage(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.billing_reconcile_abandoned_usage(uuid,uuid,boolean,text) to service_role;
commit;
