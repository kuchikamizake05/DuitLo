-- Disposable fixture database only. Every write is rolled back.
begin;
do $$
declare
 owner_id uuid := '10000000-0000-0000-0000-000000000001';
 wallet uuid := gen_random_uuid(); empty_wallet uuid := gen_random_uuid(); history_wallet uuid := gen_random_uuid();
 goal uuid := gen_random_uuid(); request uuid := gen_random_uuid();
begin
 insert into auth.users(id) values(owner_id) on conflict do nothing;
 insert into financial_accounts(id,user_id,name,kind,current_balance) values
 (wallet,owner_id,'Integrity wallet','bank',1000),(empty_wallet,owner_id,'Disposable wallet','bank',0),
 (history_wallet,owner_id,'History wallet','bank',0);
 insert into financial_goals(id,user_id,name,target_amount) values(goal,owner_id,'Integrity goal',1000);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 set local role authenticated;
 begin
  update financial_goals set current_amount=500 where id=goal;
  raise exception 'Direct goal mutation allowed';
 exception when insufficient_privilege then null;
 end;
 update financial_goals set name='Renamed safely' where id=goal;
 perform deposit_to_financial_goal(request,goal,wallet,100);
 perform deposit_to_financial_goal(request,goal,wallet,100);
 if (select current_amount from financial_goals where id=goal) <> 100
 or (select current_balance from financial_accounts where id=wallet) <> 900 then
  raise exception 'Deposit replay changed balances';
 end if;
 begin
  delete from financial_accounts where id=wallet;
  raise exception 'Nonzero wallet deletion allowed';
 exception when check_violation then null;
 end;
 insert into transactions(user_id,account_id,amount,type,status,source,note)
 values(owner_id,history_wallet,0,'expense','pending_approval','manual','Preserve history');
 begin
  delete from financial_accounts where id=history_wallet;
  raise exception 'Wallet history deletion allowed';
 exception when check_violation then null;
 end;
 delete from financial_accounts where id=empty_wallet;
 if exists(select 1 from financial_accounts where id=empty_wallet) then raise exception 'Empty wallet deletion failed'; end if;
 reset role;
end $$;
rollback;
