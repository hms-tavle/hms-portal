-- Add invite token columns to association_members
alter table public.association_members
  add column invite_token uuid,
  add column invite_expires_at timestamptz;

-- Allow anon to read a member row by a valid invite token (UUID is unguessable)
create policy "Anon can read member by valid invite token"
  on public.association_members for select
  to anon
  using (invite_token is not null and invite_expires_at > now());

-- Allow authenticated members to update invite tokens for members in their association
create policy "Members can manage invite tokens in their association"
  on public.association_members for update
  to authenticated
  using (association_id in (select * from get_my_association_ids()))
  with check (association_id in (select * from get_my_association_ids()));

-- Security definer function to claim an invite — links auth.uid() to the member row
create or replace function public.claim_invite(token uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update public.association_members
  set
    user_id = auth.uid(),
    invite_token = null,
    invite_expires_at = null
  where
    invite_token = token
    and invite_expires_at > now()
    and user_id is null;

  if not found then
    raise exception 'Invalid or expired invite token';
  end if;
end;
$$;