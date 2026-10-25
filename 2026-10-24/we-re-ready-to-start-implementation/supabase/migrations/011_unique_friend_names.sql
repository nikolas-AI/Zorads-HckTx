-- Preserve existing friends; prevent new duplicate names in each owner's library.
begin;
create function public.check_library_friend_name() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is null or new.room_id is not null or new.archived then return new; end if;
 -- Existing duplicates may still have their personality/skills edited.
 if TG_OP='UPDATE' then
   if old.owner_id=new.owner_id and old.room_id is null and not old.archived
      and lower(trim(old.name))=lower(trim(new.name)) then return new; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 if exists(select 1 from public.agents a where a.owner_id=new.owner_id
   and a.room_id is null and not a.archived and a.id<>new.id
   and lower(trim(a.name))=lower(trim(new.name))) then
   raise exception 'You already have a friend with this name. Choose a different name.';
 end if;
 return new;
end $$;
revoke all on function public.check_library_friend_name() from public,anon,authenticated;
create trigger unique_library_friend_name before insert or update on public.agents
for each row execute function public.check_library_friend_name();
NOTIFY pgrst, 'reload schema';
commit;
