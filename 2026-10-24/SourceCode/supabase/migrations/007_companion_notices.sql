-- Persist companion changes atomically alongside the roster update.
begin;
alter table public.messages add column event_type text check (event_type in ('companion_added','companion_removed'));
create function public.record_companion_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); actor_name text; action text; event text;
begin
 if new.room_id is null or actor is null then return new; end if;
 if TG_OP = 'INSERT' then
   if new.archived then return new; end if;
   action := ' added '; event := 'companion_added';
 elsif old.archived = false and new.archived = true then
   action := ' removed '; event := 'companion_removed';
 else return new;
 end if;
 select display_name into actor_name from public.members where room_id=new.room_id and user_id=actor;
 if actor_name is null then return new; end if;
 insert into public.messages(room_id,user_id,sender_name,content,event_type)
 values(new.room_id,actor,actor_name,actor_name || action || new.name || '.',event);
 return new;
end $$;
revoke all on function public.record_companion_change() from public,anon,authenticated;
create trigger companion_change_notice after insert or update of archived on public.agents
for each row execute function public.record_companion_change();
NOTIFY pgrst, 'reload schema';
commit;
