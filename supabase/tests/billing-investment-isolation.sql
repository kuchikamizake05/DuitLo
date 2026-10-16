-- Disposable database only. Checks mutation paths after Pro expiry and audited quota recovery.
begin;
do $$
declare
 owner_id uuid := '30000000-0000-0000-0000-000000000001';
 bank_id uuid:=gen_random_uuid(); investment_id uuid:=gen_random_uuid(); trading_id uuid:=gen_random_uuid();
 transaction_id uuid:=gen_random_uuid(); transfer_id uuid:=gen_random_uuid();
 stale_id uuid:=gen_random_uuid(); recent_id uuid:=gen_random_uuid(); succeeded_id uuid:=gen_random_uuid();
 reservation jsonb;
begin
 insert into auth.users(id) values(owner_id) on conflict do nothing;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.billing_settings set enabled=false where id=true;
 insert into financial_accounts(id,user_id,name,kind,current_balance) values
 (bank_id,owner_id,'Ordinary bank','bank',1000),
 (investment_id,owner_id,'Existing investment','investment',1000),
 (trading_id,owner_id,'Existing trading','trading',1000);
 insert into transactions(id,user_id,account_id,amount,type,status,source,note)
 values(transaction_id,owner_id,investment_id,0,'expense','pending_approval','manual','Existing entry');
 insert into account_transfers(id,user_id,source_account_id,destination_account_id,amount,destination_amount)
 values(transfer_id,owner_id,bank_id,investment_id,10,10);
 update public.billing_settings set enabled=true where id=true;
 set local role authenticated;
 if not exists(select 1 from transactions where id=transaction_id) then raise exception 'Expired Pro history hidden'; end if;
 begin
  insert into transactions(user_id,account_id,amount,type,status,source,note)
  values(owner_id,trading_id,0,'expense','pending_approval','manual','Must require Pro');
  raise exception 'Free linked investment transaction accepted';
 exception when check_violation then null;
 end;
 begin
  update transactions set account_id=null where id=transaction_id;
  raise exception 'Unlinking bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  delete from transactions where id=transaction_id;
  raise exception 'Deleting bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  update account_transfers set destination_account_id=trading_id where id=transfer_id;
  raise exception 'Changing linked transfer bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  delete from account_transfers where id=transfer_id;
  raise exception 'Transfer deletion bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  insert into account_transfers(user_id,source_account_id,destination_account_id,amount,destination_amount)
  values(owner_id,investment_id,bank_id,10,10);
  raise exception 'Investment withdrawal bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  update financial_accounts set kind='bank' where id=investment_id;
  raise exception 'Account retyping bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  update financial_accounts set current_balance=5000 where id=trading_id;
  raise exception 'Account balance edit bypassed investment gate';
 exception when check_violation then null;
 end;
 begin
  insert into account_equity_snapshots(user_id,account_id,equity,currency)
  values(owner_id,investment_id,5000,'IDR');
  raise exception 'Investment snapshot bypassed investment gate';
 exception when check_violation then null;
 end;
 -- Ordinary manual recording and wallet edits remain available.
 update financial_accounts set name='Still editable' where id=bank_id;
 insert into transactions(user_id,account_id,amount,type,status,source,note)
 values(owner_id,bank_id,0,'expense','pending_approval','manual','Ordinary Free entry');
 begin
  perform public.billing_reconcile_abandoned_usage(owner_id,stale_id,true,'Verified provider logs show no successful result');
  raise exception 'Browser may reconcile receipt quota';
 exception when insufficient_privilege then null;
 end;
 reset role;
 insert into public.billing_usage_operations(id,user_id,month,metric,status,created_at) values
 (stale_id,owner_id,date_trunc('month',now() at time zone 'UTC')::date,'receipt_scan','reserved',now()-interval '25 hours'),
 (recent_id,owner_id,date_trunc('month',now() at time zone 'UTC')::date,'receipt_scan','reserved',now()),
 (succeeded_id,owner_id,date_trunc('month',now() at time zone 'UTC')::date,'receipt_scan','succeeded',now()-interval '25 hours');
 begin
  perform public.billing_reconcile_abandoned_usage(owner_id,recent_id,true,'Verified failure but operation may still be active');
  raise exception 'Recent reservation was refunded';
 exception when check_violation then null;
 end;
 begin
  perform public.billing_reconcile_abandoned_usage(owner_id,succeeded_id,true,'Must not change previously successful operations');
  raise exception 'Successful operation was manually refunded';
 exception when check_violation then null;
 end;
 begin
  perform public.billing_reconcile_abandoned_usage(owner_id,stale_id,false,'No evidence of provider failure or abandoned work');
  raise exception 'Unverified reservation was refunded';
 exception when check_violation then null;
 end;
 perform public.billing_reconcile_abandoned_usage(owner_id,stale_id,true,'Verified provider logs show no successful result');
 perform public.billing_reconcile_abandoned_usage(owner_id,stale_id,true,'Repeated reconciliation remains idempotent and audited');
 reservation:=public.billing_reserve_usage(owner_id,stale_id,'receipt_scan');
 if reservation->>'replayed'<>'true' or reservation->>'reserved'<>'false' then raise exception 'Refunded operation may re-spend quota'; end if;
 if (select count(*) from public.billing_usage_reconciliations where operation_id=stale_id)<>1 then raise exception 'Reconciliation audit missing or duplicated'; end if;
end $$;
rollback;
