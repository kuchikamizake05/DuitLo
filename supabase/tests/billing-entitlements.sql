-- Run only against the disposable bootstrap database; all changes roll back.
begin;
do $$
declare
 owner_id uuid := '20000000-0000-0000-0000-000000000001';
 other_id uuid := '20000000-0000-0000-0000-000000000002';
 operation_id uuid := gen_random_uuid();
 usage_id uuid := gen_random_uuid();
 result jsonb;
 original_expiry timestamptz;
begin
 insert into auth.users(id) values(owner_id),(other_id) on conflict do nothing;
 update public.billing_settings set enabled=true where id=true;
 for i in 1..3 loop
  insert into public.financial_accounts(user_id,name,kind) values(owner_id,'Wallet '||i,'bank');
 end loop;
 begin
  insert into public.financial_accounts(user_id,name,kind) values(owner_id,'Over limit','bank');
  raise exception 'Free wallet limit bypassed';
 exception when check_violation then null;
 end;
 insert into public.financial_goals(user_id,name,target_amount) values(owner_id,'First goal',1000);
 begin
  insert into public.financial_goals(user_id,name,target_amount) values(owner_id,'Second goal',1000);
  raise exception 'Free goal limit bypassed';
 exception when check_violation then null;
 end;
 for i in 1..3 loop
  insert into public.financial_budgets(user_id,category,month,limit_amount) values(owner_id,'Category '||i,'2026-10-01',1000);
 end loop;
 begin
  insert into public.financial_budgets(user_id,category,month,limit_amount) values(owner_id,'Fourth category','2026-10-01',1000);
  raise exception 'Free budget limit bypassed';
 exception when check_violation then null;
 end;
 insert into public.financial_budgets(user_id,category,month,limit_amount) values(owner_id,'Next month','2026-11-01',1000);
 begin
  perform public.billing_assert_investment_write(owner_id);
  raise exception 'Free investment gate bypassed';
 exception when check_violation then null;
 end;
 for i in 1..15 loop
  perform public.billing_reserve_usage(owner_id,gen_random_uuid(),'receipt_scan');
 end loop;
 begin
  perform public.billing_reserve_usage(owner_id,gen_random_uuid(),'receipt_scan');
  raise exception 'Free scan quota bypassed';
 exception when check_violation then null;
 end;
 -- Same operation is not charged twice, and refund is idempotent.
 insert into public.billing_usage_operations(id,user_id,month,metric,status)
 values(usage_id,other_id,date_trunc('month',now() at time zone 'UTC')::date,'receipt_scan','reserved');
 result := public.billing_reserve_usage(other_id,usage_id,'receipt_scan');
 if result->>'replayed'<>'true' then raise exception 'Reservation replay accepted'; end if;
 perform public.billing_finish_usage(other_id,usage_id,false);
 perform public.billing_finish_usage(other_id,usage_id,false);
 if (select count(*) from public.billing_usage_operations where user_id=other_id and status<>'refunded')<>0 then
  raise exception 'Failed scans consume quota';
 end if;
 result := public.billing_claim_checkout(owner_id,operation_id,59000,'IDR',30);
 perform public.billing_bind_invoice(operation_id,'invoice-test','https://checkout.xendit.co/test');
 result := public.billing_settle_invoice('invoice-test','fintrack-'||operation_id,59000,'IDR');
 select pro_until into original_expiry from public.billing_subscriptions where user_id=owner_id;
 perform public.billing_assert_investment_write(owner_id);
 -- Completed work cannot later be refunded by a replayed failure.
 perform public.billing_reserve_usage(other_id,gen_random_uuid(),'receipt_scan');
 perform public.billing_reserve_usage(owner_id,operation_id,'receipt_scan');
 perform public.billing_finish_usage(owner_id,operation_id,true);
 perform public.billing_finish_usage(owner_id,operation_id,false);
 if (select status from public.billing_usage_operations where id=operation_id)<>'succeeded' then raise exception 'Successful scan was refunded'; end if;
 perform public.billing_settle_invoice('invoice-test','fintrack-'||operation_id,59000,'IDR');
 if (select pro_until from public.billing_subscriptions where user_id=owner_id)<>original_expiry then raise exception 'Callback replay extended Pro'; end if;
 perform public.billing_expire_checkout(operation_id,'invoice-test');
 if (select status from public.billing_checkout_operations where id=operation_id)<>'paid' then raise exception 'Expiry revoked completed payment'; end if;
 begin
  perform public.billing_settle_invoice('invoice-test','fintrack-'||operation_id,1,'IDR');
  raise exception 'Mismatched callback accepted';
 exception when check_violation then null;
 end;
 update public.billing_subscriptions set pro_until=now()-interval '1 day' where user_id=owner_id;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 if (select count(*) from financial_accounts where user_id=owner_id)<>3 then raise exception 'Expiry removed historical reads'; end if;
 begin
  perform public.billing_settle_invoice('invoice-test','fintrack-'||operation_id,59000,'IDR');
  raise exception 'Browser may settle billing';
 exception when insufficient_privilege then null;
 end;
 reset role;
end $$;
rollback;
