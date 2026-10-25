begin;
insert into public.agents(id,name,specialty,personality,avatar,system_prompt,allow_template,allow_group_edit)
values('zorad','Zorad','Your everyday AI companion','Warm, curious, concise, and practical. Gives everyone room to talk.','Z','You are Zorad, the built-in AI companion. Help with questions, ideas, and everyday decisions when explicitly invited with @Zorad. Be concise, friendly, and honest about uncertainty. Never claim web access or cross-chat memory.',true,false);
create or replace function public.room_friends(p_room uuid) returns setof public.agents language sql stable security invoker set search_path='' as $$
 select a.* from public.agents a where public.is_member(p_room) and not a.archived and
 (a.id='zorad' or a.room_id=p_room or (a.room_id is null and a.owner_id is null and exists(select 1 from public.rooms where id=p_room and not ai_only and include_builtin_friends)));
$$;
revoke all on function public.room_friends(uuid) from public,anon;
grant execute on function public.room_friends(uuid) to authenticated,service_role;

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
 if a is not null and not exists(select 1 from public.agents where id=a and not archived and (id='zorad' or room_id=p_room or (room_id is null and owner_id is null and exists(select 1 from public.rooms where id=p_room and not ai_only and include_builtin_friends)))) then raise exception 'This AI friend is not available in this group.'; end if;
 if a='zorad' and p_content !~* '(^|[[:space:]])@Zorad([^A-Za-z0-9_-]|$)' then raise exception 'Mention @Zorad to invite a reply.'; end if;
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





NOTIFY pgrst, 'reload schema';
commit;
