begin;
insert into auth.users(id,email) values ('b1000000-0000-4000-8000-000000000001','data-a@example.invalid'),('b1000000-0000-4000-8000-000000000002','data-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select public.submit_data_control_request('b2000000-0000-4000-8000-000000000001','delete_account','Delete my account');
select public.submit_data_control_request('b2000000-0000-4000-8000-000000000001','delete_account','Delete my account');
do $$ begin
 if (select count(*) from public.data_control_requests) <> 1 then raise exception 'replay created duplicate'; end if;
 begin
  perform public.submit_data_control_request('b2000000-0000-4000-8000-000000000002','delete_account','Again');
  raise exception 'second pending delete permitted';
 exception when unique_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.data_control_requests) then raise exception 'foreign requests visible'; end if;
 begin
  perform public.cancel_data_control_request('b2000000-0000-4000-8000-000000000001');
  raise exception 'foreign cancel permitted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select public.cancel_data_control_request('b2000000-0000-4000-8000-000000000001');
do $$ begin
 if not exists(select 1 from public.data_control_requests where status='cancelled') then raise exception 'cancel not persisted'; end if;
 begin
  update public.data_control_requests set status='completed';
  raise exception 'client updated operator status';
 exception when insufficient_privilege then null; end;
 begin
  perform public.submit_data_control_request('b2000000-0000-4000-8000-000000000001','support','Changed replay');
  raise exception 'mismatched retry accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select public.submit_data_control_request('b2000000-0000-4000-8000-000000000003','support','Help 1');
select public.submit_data_control_request('b2000000-0000-4000-8000-000000000004','support','Help 2');
select public.submit_data_control_request('b2000000-0000-4000-8000-000000000005','support','Help 3');
select public.submit_data_control_request('b2000000-0000-4000-8000-000000000006','support','Help 4');
do $$ begin
 begin
  perform public.submit_data_control_request('b2000000-0000-4000-8000-000000000007','support','Too many');
  raise exception 'daily abuse limit bypassed';
 exception when program_limit_exceeded then null; end;
end $$;
rollback;
