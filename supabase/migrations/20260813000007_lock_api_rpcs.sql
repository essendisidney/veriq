-- Close the PostgREST back door: API snapshots are server-only.
-- The Next.js app calls these with the service role. Anon and signed-in
-- users must not execute them via /rest/v1/rpc.

revoke all on function public.veriq_api_risk(text, text) from public, anon, authenticated;
revoke all on function public.veriq_api_snapshot(text, text) from public, anon, authenticated;
grant execute on function public.veriq_api_risk(text, text) to service_role;
grant execute on function public.veriq_api_snapshot(text, text) to service_role;
