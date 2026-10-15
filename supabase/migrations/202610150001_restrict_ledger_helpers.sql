begin;

-- Ledger triggers still need the helper after direct client execution is revoked.
-- These functions return trigger and cannot be called as ordinary RPCs.
alter function public.apply_confirmed_transaction_balance()
  security definer set search_path = public, pg_temp;
alter function public.apply_transfer_balance()
  security definer set search_path = public, pg_temp;

revoke execute on function public.apply_account_delta(uuid,numeric)
  from public, anon, authenticated;
revoke execute on function public.assert_account_owner(uuid,uuid)
  from public, anon, authenticated;

commit;
