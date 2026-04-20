-- SECURITY DEFINER — reads as superuser, bypasses RLS.
--
-- This is intentional: anon users must be able to look up their invite before
-- they have an account, so they cannot be subject to the authenticated-only
-- RLS policies on association_members.
--
-- RULES FOR EDITING THIS FUNCTION:
--   1. Never add columns to the SELECT beyond what is already returned.
--      Every returned field is visible to anyone who holds the token.
--   2. Never accept any parameter other than p_token, and never interpolate
--      it into a dynamic SQL string — always use it as a bound parameter.
--      Violating this would allow SQL injection with superuser privileges.
--   3. The WHERE clause must always filter by invite_token, invite_expires_at > now(),
--      and user_id IS NULL. Removing any of these conditions would allow
--      enumeration of claimed or non-invite rows.
--   4. This function is callable via the public REST API (/rest/v1/rpc/lookup_invite).
--      Keep its surface area minimal.
create or replace function public.lookup_invite(p_token uuid)
returns table (
  full_name        text,
  role_code        text,
  email            text,
  association_name text
)
language plpgsql security definer
set search_path = public
as $$
begin
  return query
    select
      am.full_name,
      am.role_code,
      am.email,
      a.navn as association_name
    from public.association_members am
    join public.associations a on a.id = am.association_id
    where am.invite_token      = p_token
      and am.invite_expires_at > now()
      and am.user_id           is null;
end;
$$;
