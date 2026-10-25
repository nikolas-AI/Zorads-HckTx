-- Reusable originals + room-specific copies. No chat history is copied.
begin;
alter table public.agents add column source_id text references public.agents(id);
alter table public.agents add column skills text[] not null default '{}';
alter table public.agents add column allow_template boolean not null default false;
alter table public.agents add column allow_group_edit boolean not null default false;
alter table public.rooms add column ai_only boolean not null default false;
grant select(ai_only) on public.rooms to authenticated;
update public.agents set allow_template=true where owner_id is null;
-- Preserve existing room IDs, replies and activity, and seed each creator's library.
insert into public.agents(id,name,specialty,personality,avatar,system_prompt,owner_id,archived)
select 'library-'||id,name,specialty,personality,avatar,system_prompt,owner_id,archived from public.agents where room_id is not null;
update public.agents set source_id='library-'||id where room_id is not null;
drop policy agent_read on public.agents;
create policy agent_read on public.agents for select to authenticated using(
 (room_id is null and (owner_id is null or owner_id=auth.uid())) or (room_id is not null and public.is_member(room_id))
);
create function public.room_friends(p_room uuid) returns setof public.agents language sql stable security invoker set search_path='' as $$
 select a.* from public.agents a where public.is_member(p_room) and not a.archived and
 (a.room_id=p_room or (a.room_id is null and a.owner_id is null and exists(select 1 from public.rooms where id=p_room and not ai_only)));
$$;
revoke all on function public.room_friends(uuid) from public,anon;
grant execute on function public.room_friends(uuid) to authenticated,service_role;

create function public.save_studio_friend(p_id text,p_source text,p_config jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); old public.agents; src public.agents; root public.agents; a text:=p_id;
 n text:=trim(p_config->>'name'); persona text:=trim(p_config->>'personality'); interests text:=trim(p_config->>'specialty');
 icon text:=trim(p_config->>'avatar'); instructions text:=coalesce(trim(p_config->>'system_prompt'),''); chosen text[];
 template boolean:=coalesce((p_config->>'allow_template')::boolean,false); shared boolean:=coalesce((p_config->>'allow_group_edit')::boolean,false);
begin
 if u is null then raise exception 'Sign in first'; end if;
 if n is null or n !~ '^[A-Za-z][A-Za-z0-9_-]{1,23}$' then raise exception 'Use a name of 2-24 letters, numbers, underscores or hyphens, starting with a letter.'; end if;
 if persona is null or char_length(persona) not between 1 and 500 or interests is null or char_length(interests) not between 1 and 200 or icon is null or char_length(icon) not between 1 and 8 or char_length(instructions)>1500 then raise exception 'Check the profile length limits.'; end if;
 select coalesce(array_agg(distinct value),'{}') into chosen from jsonb_array_elements_text(coalesce(p_config->'skills','[]'));
 if cardinality(chosen)>6 or not chosen <@ array['research','nerdy','code-review','data-analysis','expert','teacher','tutor','creative','planner'] then raise exception 'Choose up to six available skills.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if p_id is not null then
   select * into old from public.agents where id=p_id;
   if old.room_id is not null then perform pg_advisory_xact_lock(hashtextextended(old.room_id::text,1)); end if;
   select * into old from public.agents where id=p_id for update;
   if not found or old.archived or old.owner_id is null then raise exception 'Friend not found'; end if;
   if old.room_id is null then
     if old.owner_id<>u then raise exception 'Only the creator can edit the original.'; end if;
   else
     if not public.is_member(old.room_id) then raise exception 'Room not found'; end if;
     select * into root from public.agents where id=old.source_id;
     if old.owner_id<>u and not coalesce(root.allow_group_edit,false) then raise exception 'The creator has not allowed group edits.'; end if;
     -- Group members can customize behavior, never grant themselves sharing rights.
     template:=old.allow_template; shared:=old.allow_group_edit;

     if exists(select 1 from public.agents where id<>p_id and not archived and lower(name)=lower(n) and (room_id=old.room_id or (room_id is null and owner_id is null and exists(select 1 from public.rooms where id=old.room_id and not ai_only)))) then raise exception 'A friend already uses that name in this group.'; end if;
   end if;
 else
   if p_source is not null then
     select * into src from public.agents where id=p_source;
     if not found or src.archived or (src.room_id is not null and not public.is_member(src.room_id)) or (src.room_id is null and src.owner_id is not null and src.owner_id<>u) then raise exception 'Template not available'; end if;
     if src.source_id is not null then select * into root from public.agents where id=src.source_id; else root:=src; end if;
     if src.owner_id is distinct from u and not coalesce(root.allow_template,false) then raise exception 'The creator has not allowed template copying.'; end if;
   end if;
   if (select count(*) from public.agents where owner_id=u and room_id is null)>=50 then raise exception 'Your friend library is full (50).'; end if;
   a:='custom-'||gen_random_uuid()::text;
 end if;
 if old.id is null then
   insert into public.agents(id,name,specialty,personality,avatar,system_prompt,owner_id,skills,allow_template,allow_group_edit)
   values(a,n,interests,persona,icon,instructions,u,chosen,template,shared);
 else
   update public.agents set name=n,specialty=interests,personality=persona,avatar=icon,system_prompt=instructions,skills=chosen,allow_template=template,allow_group_edit=shared where id=a;
   if old.room_id is null then
     -- Permissions are live; profile changes do not overwrite group customizations.
     update public.agents set allow_template=template,allow_group_edit=shared where source_id=a;
   end if;
 end if;
 return a;
end $$;
revoke all on function public.save_studio_friend(text,text,jsonb) from public,anon;
grant execute on function public.save_studio_friend(text,text,jsonb) to authenticated;

create function public.add_friend_to_room(p_friend text,p_room uuid) returns text
language plpgsql security definer set search_path='' as $$
declare src public.agents; a text; u uuid:=auth.uid();
begin
 if u is null or not public.is_member(p_room) then raise exception 'Room not found'; end if;
 select * into src from public.agents where id=p_friend and room_id is null and owner_id=u and not archived for share;
 if not found then raise exception 'Choose a friend from your own library.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room::text,1));
 select id into a from public.agents where source_id=p_friend and room_id=p_room and not archived;
 if found then return a; end if;
 if (select count(*) from public.agents where room_id=p_room and not archived)>=10 then raise exception 'This group already has 10 custom friends.'; end if;
 if exists(select 1 from public.agents where not archived and lower(name)=lower(src.name) and (room_id=p_room or (room_id is null and owner_id is null and exists(select 1 from public.rooms where id=p_room and not ai_only)))) then raise exception 'A friend already uses that name in this group. Rename your library friend first.'; end if;
 a:='custom-'||gen_random_uuid()::text;
 insert into public.agents(id,name,specialty,personality,avatar,system_prompt,owner_id,room_id,source_id,skills,allow_template,allow_group_edit)
 values(a,src.name,src.specialty,src.personality,src.avatar,src.system_prompt,src.owner_id,p_room,src.id,src.skills,src.allow_template,src.allow_group_edit);
 return a;
end $$;
revoke all on function public.add_friend_to_room(text,uuid) from public,anon;
grant execute on function public.add_friend_to_room(text,uuid) to authenticated;

create function public.start_friend_chat(p_friends text[],p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r uuid; f text;
begin
 if cardinality(p_friends) is null or cardinality(p_friends) not between 1 and 5 then raise exception 'Select one to five friends.'; end if;
 if cardinality(p_friends)<>(select count(distinct x) from unnest(p_friends) x) then raise exception 'Choose each friend once.'; end if;
 r:=public.create_room(case when cardinality(p_friends)=1 then 'Chat with '||coalesce((select name from public.agents where id=p_friends[1]),'friend') else 'My AI circle' end,p_display_name);
 update public.rooms set ai_only=true where id=r;
 foreach f in array p_friends loop perform public.add_friend_to_room(f,r); end loop;
 return r;
end $$;
revoke all on function public.start_friend_chat(text[],text) from public,anon;
grant execute on function public.start_friend_chat(text[],text) to authenticated;

-- Old writes cannot bypass new permissions; current chat uses submit_routed_message.
revoke execute on function public.save_friend(uuid,text,text,text,text,text,text), public.submit_message(uuid,uuid,text,text) from authenticated;
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
 if a is not null and not exists(select 1 from public.agents where id=a and not archived and (room_id=p_room or (room_id is null and owner_id is null and exists(select 1 from public.rooms where id=p_room and not ai_only)))) then raise exception 'This AI friend is not available in this group.'; end if;
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



create or replace function public.join_room(p_room uuid,p_invite uuid,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if char_length(trim(p_display_name)) not between 1 and 32 then raise exception 'Enter a display name'; end if;
 if not exists(select 1 from public.rooms where id=p_room and invite_token=p_invite and not ai_only) then raise exception 'This invite is invalid.'; end if;
 insert into public.members values(p_room,auth.uid(),trim(p_display_name)) on conflict(room_id,user_id) do update set display_name=excluded.display_name;
 return p_room;
end $$;
create or replace function public.room_invite(p_room uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member(p_room) or exists(select 1 from public.rooms where id=p_room and ai_only) then raise exception 'Invites are unavailable for private AI chats.'; end if;
 return (select invite_token from public.rooms where id=p_room);
end $$;

commit;
