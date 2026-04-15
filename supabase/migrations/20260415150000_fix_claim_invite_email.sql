-- When a member claims an invite, sync their auth email into association_members.email.
-- coalesce preserves an email entered during onboarding; fills it in if it was left blank.

create or replace function public.claim_invite(token uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_full_name  text;
  v_auth_email text;
begin
  select email into v_auth_email from auth.users where id = auth.uid();

  update public.association_members
  set
    user_id           = auth.uid(),
    email             = coalesce(email, v_auth_email),
    invite_token      = null,
    invite_expires_at = null
  where
    invite_token      = token
    and invite_expires_at > now()
    and user_id       is null
  returning full_name into v_full_name;

  if not found then
    raise exception 'Invalid or expired invite token';
  end if;

  insert into public.user_profiles (id, full_name)
  values (auth.uid(), v_full_name)
  on conflict (id) do nothing;
end;
$$;
