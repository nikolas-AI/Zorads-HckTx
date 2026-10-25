begin;
alter table public.agents add column room_id uuid references public.rooms(id) on delete cascade;
alter table public.agents add column owner_id uuid references auth.users(id);
alter table public.agents add column archived boolean not null default false;
create unique index agents_room_name on public.agents(room_id,lower(name)) where not archived;
drop policy agent_read on public.agents;
create policy agent_read on public.agents for select to authenticated using(room_id is null or public.is_member(room_id));

-- Members create friends in this group; only their creator can edit or remove them.
create function public.save_friend(p_room uuid,p_id text,p_name text,p_personality text,p_interests text,p_avatar text,p_instructions text)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); a text:=p_id;
begin
 if u is null or not public.is_member(p_room) then raise exception 'Room not found'; end if;
 if p_name is null or trim(p_name) !~ '^[A-Za-z][A-Za-z0-9_-]{1,23}$' then raise exception 'Use a name of 2-24 letters, numbers, underscores or hyphens, starting with a letter.'; end if;
 if p_personality is null or char_length(trim(p_personality)) not between 1 and 500
 or p_interests is null or char_length(trim(p_interests)) not between 1 and 200
 or p_avatar is null or char_length(trim(p_avatar)) not between 1 and 8
 or p_instructions is null or char_length(p_instructions)>1500 then raise exception 'Check the friend details and length limits.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_room::text,1));
 if p_id is not null and not exists(select 1 from public.agents where id=p_id and room_id=p_room and owner_id=u and not archived) then raise exception 'Only the creator can edit this friend.'; end if;
 if exists(select 1 from public.agents where lower(name)=lower(trim(p_name)) and (room_id is null or room_id=p_room) and not archived and id is distinct from p_id)
 then raise exception 'An AI friend already uses that name in this group.'; end if;
 if p_id is null then
   if (select count(*) from public.agents where room_id=p_room and not archived)>=10 then raise exception 'This group already has 10 custom friends.'; end if;
   if (select count(*) from public.agents where owner_id=u)>=50 then raise exception 'Your custom friend limit has been reached.'; end if;
   a:='custom-'||gen_random_uuid()::text;
   insert into public.agents(id,name,specialty,personality,avatar,system_prompt,room_id,owner_id)
   values(a,trim(p_name),trim(p_interests),trim(p_personality),trim(p_avatar),trim(p_instructions),p_room,u);
 else
   update public.agents set name=trim(p_name),specialty=trim(p_interests),personality=trim(p_personality),avatar=trim(p_avatar),system_prompt=trim(p_instructions)
   where id=p_id and room_id=p_room and owner_id=u and not archived;
   if not found then raise exception 'Only the creator can edit this friend.'; end if;
 end if;
 return a;
end $$;
create function public.remove_friend(p_room uuid,p_id text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member(p_room) then raise exception 'Room not found'; end if;

 perform pg_advisory_xact_lock(hashtextextended(p_room::text,1));
 update public.agents set archived=true where id=p_id and room_id=p_room and owner_id=auth.uid() and not archived;
 if not found then raise exception 'Only the creator can remove this friend.'; end if;
end $$;
revoke all on function public.save_friend(uuid,text,text,text,text,text,text), public.remove_friend(uuid,text) from public,anon;
grant execute on function public.save_friend(uuid,text,text,text,text,text,text), public.remove_friend(uuid,text) to authenticated;
alter publication supabase_realtime add table public.agents;
create or replace function public.submit_routed_message(p_id uuid,p_room uuid,p_user uuid,p_content text,p_routing jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare n text; existing public.messages; a text:=p_routing->>'agentId'; prior uuid:=nullif(p_routing->>'replyToId','')::uuid;
begin
 if p_user is null or not exists(select 1 from public.members where room_id=p_room and user_id=p_user) then raise exception 'Room not found'; end if;
 if p_content is null or char_length(trim(p_content)) not between 1 and 4000 then raise exception 'Messages must be 1-4000 characters'; end if;
 if p_routing is null or p_routing->>'complexity' is null or p_routing->>'complexity' not in ('LOW','MEDIUM','HIGH') then raise exception 'Invalid routing'; end if;

 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_room::text,1));
 select * into existing from public.messages where id=p_id;
 if found then
   if existing.user_id=p_user and existing.room_id=p_room and existing.content=trim(p_content) then return p_id; end if;
   raise exception 'Request ID already used';
 end if;
 if a is not null and not exists(select 1 from public.agents where id=a and not archived and (room_id is null or room_id=p_room)) then raise exception 'This AI friend is not available in this group.'; end if;
 if prior is not null and not exists(select 1 from public.messages where id=prior and room_id=p_room and agent_id=a and status='complete') then raise exception 'Invalid earlier reply'; end if;
 if (select count(*) from public.messages where user_id=p_user and created_at>now()-interval '1 minute')>=30 then raise exception 'Slow down a little. Try again in a minute.'; end if;
 if a is not null and (select count(*) from public.messages where room_id=p_room and agent_id is not null and created_at>now()-interval '1 minute')>=12 then raise exception 'AI request limit reached. Try again in a minute.'; end if;
 select display_name into n from public.members where room_id=p_room and user_id=p_user;
 insert into public.messages(id,room_id,user_id,sender_name,content,routing) values(p_id,p_room,p_user,n,trim(p_content),p_routing);
 if a is not null then
   insert into public.messages(room_id,sender_name,agent_id,parent_id,status) select p_room,name,id,p_id,'pending' from public.agents where id=a;
 end if;
 return p_id;
end $$;
revoke all on function public.submit_routed_message(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_routed_message(uuid,uuid,uuid,text,jsonb) to service_role;


commit;




