begin;
create table public.data_control_requests (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('delete_account','export_data','correction','support')),
 details text not null default '' check (char_length(details)<=2000),
 status text not null default 'pending' check (status in ('pending','processing','completed','cancelled','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolved_at timestamptz,
 outcome text check (char_length(outcome)<=4000)
);
create unique index one_open_account_deletion on public.data_control_requests(user_id) where kind='delete_account' and status in ('pending','processing');
create index data_control_requests_owner_created on public.data_control_requests(user_id,created_at desc);
alter table public.data_control_requests enable row level security;
revoke all on public.data_control_requests from public,anon,authenticated;
grant select on public.data_control_requests to authenticated;
grant all on public.data_control_requests to service_role;
create policy own_data_control_requests on public.data_control_requests for select to authenticated using (user_id=(select auth.uid()));

create function public.submit_data_control_request(request_id uuid,request_kind text,request_details text default '') returns public.data_control_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid:=auth.uid(); existing public.data_control_requests; result public.data_control_requests; normalized text:=btrim(coalesce(request_details,''));
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if request_id is null or request_kind is null or request_kind not in ('delete_account','export_data','correction','support') or char_length(normalized)>2000 or (request_kind<>'delete_account' and normalized='') then
  raise exception 'Invalid request' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('data-control:'||owner_id::text,0));
 select * into existing from public.data_control_requests where id=request_id;
 if found then
  if existing.user_id<>owner_id then raise exception 'Request unavailable' using errcode='42501'; end if;
  if existing.kind<>request_kind or existing.details<>normalized then raise exception 'Request ID reused with different details' using errcode='22023'; end if;
  return existing;
 end if;
 if (select count(*) from public.data_control_requests where user_id=owner_id and created_at>now()-interval '24 hours')>=5 then
  raise exception 'Daily request limit reached' using errcode='54000';
 end if;
 insert into public.data_control_requests(id,user_id,kind,details) values(request_id,owner_id,request_kind,normalized) returning * into result;
 return result;
end $$;
create function public.cancel_data_control_request(request_id uuid) returns public.data_control_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid:=auth.uid(); result public.data_control_requests;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('data-control:'||owner_id::text,0));
 select * into result from public.data_control_requests where id=request_id and user_id=owner_id for update;
 if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
 if result.status='cancelled' then return result; end if;
 if result.status<>'pending' then raise exception 'Request already being processed; contact support' using errcode='22023'; end if;
 update public.data_control_requests set status='cancelled',updated_at=now(),resolved_at=now() where id=request_id returning * into result;
 return result;
end $$;
revoke all on function public.submit_data_control_request(uuid,text,text) from public,anon;
revoke all on function public.cancel_data_control_request(uuid) from public,anon;
grant execute on function public.submit_data_control_request(uuid,text,text) to authenticated;
grant execute on function public.cancel_data_control_request(uuid) to authenticated;
commit;
