-- Run after the ledger-helper migration. All fixtures roll back.
begin;
do $$
declare
  owner_id uuid;
  outsider_id uuid := gen_random_uuid();
  source_id uuid := gen_random_uuid();
  destination_id uuid := gen_random_uuid();
  transaction_id uuid := gen_random_uuid();
  transfer_id uuid := gen_random_uuid();
  goal_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  affected integer;
begin
  if has_function_privilege('anon','public.apply_account_delta(uuid,numeric)','execute')
     or has_function_privilege('authenticated','public.apply_account_delta(uuid,numeric)','execute')
     or has_function_privilege('anon','public.assert_account_owner(uuid,uuid)','execute')
     or has_function_privilege('authenticated','public.assert_account_owner(uuid,uuid)','execute') then
    raise exception 'Direct helper execution is still granted';
  end if;
  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then raise exception 'A fixture owner is required'; end if;

  insert into public.financial_accounts(id,user_id,name,kind,currency,current_balance)
  values(source_id,owner_id,'RLS rollback fixture source','bank','IDR',1000),
        (destination_id,owner_id,'RLS rollback fixture destination','bank','IDR',0);
  insert into public.financial_goals(id,user_id,name,target_amount,current_amount,currency)
  values(goal_id,owner_id,'RLS rollback fixture goal',1000,0,'IDR');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  set local role authenticated;
  if auth.uid() is distinct from owner_id then raise exception 'Owner session simulation failed'; end if;
  begin
    perform public.apply_account_delta(source_id,1);
    raise exception 'Authenticated caller bypassed helper restriction';
  exception when insufficient_privilege then null;
  end;

  insert into public.transactions(id,user_id,account_id,amount,type,status,source,note)
  values(transaction_id,owner_id,source_id,100,'expense','confirmed','manual','RLS rollback fixture');
  if (select current_balance from public.financial_accounts where id=source_id)<>900 then raise exception 'Transaction insert balance failed'; end if;
  update public.transactions set amount=150 where id=transaction_id;
  if (select current_balance from public.financial_accounts where id=source_id)<>850 then raise exception 'Transaction update balance failed'; end if;
  delete from public.transactions where id=transaction_id;
  if (select current_balance from public.financial_accounts where id=source_id)<>1000 then raise exception 'Transaction delete balance failed'; end if;

  insert into public.account_transfers(id,user_id,source_account_id,destination_account_id,amount,destination_amount,currency,destination_currency)
  values(transfer_id,owner_id,source_id,destination_id,100,100,'IDR','IDR');
  if (select current_balance from public.financial_accounts where id=source_id)<>900
     or (select current_balance from public.financial_accounts where id=destination_id)<>100 then raise exception 'Transfer insert balance failed'; end if;
  update public.account_transfers set amount=150,destination_amount=150 where id=transfer_id;
  if (select current_balance from public.financial_accounts where id=source_id)<>850
     or (select current_balance from public.financial_accounts where id=destination_id)<>150 then raise exception 'Transfer update balance failed'; end if;
  delete from public.account_transfers where id=transfer_id;
  if (select current_balance from public.financial_accounts where id=source_id)<>1000
     or (select current_balance from public.financial_accounts where id=destination_id)<>0 then raise exception 'Transfer delete balance failed'; end if;

  perform public.deposit_to_financial_goal(request_id,goal_id,source_id,100);
  perform public.deposit_to_financial_goal(request_id,goal_id,source_id,100);
  if (select current_balance from public.financial_accounts where id=source_id)<>900
     or (select current_amount from public.financial_goals where id=goal_id)<>100 then raise exception 'Goal deposit or idempotency failed'; end if;

  reset role;
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true);
  set local role authenticated;
  if exists(select 1 from public.financial_accounts where id in (source_id,destination_id)) then raise exception 'Cross-user read was allowed'; end if;
  update public.financial_accounts set current_balance=0 where id=source_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-user update was allowed'; end if;
  delete from public.financial_accounts where id=destination_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-user delete was allowed'; end if;
  begin
    insert into public.financial_accounts(user_id,name,kind) values(owner_id,'RLS spoofed owner','bank');
    raise exception 'Spoofed owner insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.deposit_to_financial_goal(gen_random_uuid(),goal_id,source_id,100);
    raise exception 'Cross-user goal deposit was allowed';
  exception when raise_exception then
    if sqlerrm<>'Goal unavailable' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  set local role anon;
  if exists(select 1 from public.financial_accounts where id=source_id) then raise exception 'Anonymous read was allowed'; end if;
  begin
    perform public.apply_account_delta(source_id,1);
    raise exception 'Anonymous caller bypassed helper restriction';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;
rollback;
