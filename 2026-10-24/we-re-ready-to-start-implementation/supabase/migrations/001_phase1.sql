-- Phase 1: authenticated anonymous users, invite-gated rooms, atomic submissions.
create table public.rooms (
 id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 60),
 owner_id uuid not null references auth.users(id), invite_token uuid not null default gen_random_uuid(), created_at timestamptz not null default now()
);
create table public.members (
 room_id uuid not null references public.rooms(id) on delete cascade, user_id uuid not null references auth.users(id),
 display_name text not null check (char_length(display_name) between 1 and 32), primary key(room_id,user_id)
);
create table public.agents (
 id text primary key, name text not null, specialty text not null, personality text not null, avatar text not null, system_prompt text not null
);
insert into public.agents values
 ('paul','Paul','Everyday life','Warm, witty & practical','P','You are Paul, a warm, witty friend helping with outfits, food and everyday decisions. Give practical, casual advice in a few sentences.'),
 ('ravi','Ravi','Research & perspective','Curious, thoughtful & clear','R','You are Ravi, a curious, analytical friend. Compare options fairly, distinguish facts from uncertainty, and give concise reasoning. You have no live web search in this version. Explicitly say you cannot verify current facts, prices or availability when relevant. Never fabricate sources.'),
 ('kaira','Kaira','Ideas & good times','Playful, creative & social','K','You are Kaira, a playful, imaginative friend who brings people together. Offer creative ideas and turn discussions into practical plans. Distinguish suggestions from confirmed decisions. Be upbeat and concise.');
create table public.messages (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 user_id uuid references auth.users(id), sender_name text not null, agent_id text references public.agents(id),
 content text not null default '', status text not null default 'complete' check(status in ('complete','pending','generating','failed')),
 parent_id uuid unique references public.messages(id), created_at timestamptz not null default now(),
 model text, input_tokens integer, output_tokens integer,
 check ((agent_id is null and user_id is not null and parent_id is null and status='complete') or (agent_id is not null and user_id is null and parent_id is not null))
);
create index messages_room_time on public.messages(room_id,created_at desc);
create index messages_user_time on public.messages(user_id,created_at desc);
create index members_user on public.members(user_id);
create function public.is_member(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members where room_id=r and user_id=(select auth.uid()));
$$;
revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;
alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.agents enable row level security;
alter table public.messages enable row level security;
create policy room_read on public.rooms for select to authenticated using(public.is_member(id));
create policy member_read on public.members for select to authenticated using(public.is_member(room_id));
create policy agent_read on public.agents for select to authenticated using(true);
create policy message_read on public.messages for select to authenticated using(public.is_member(room_id));
revoke all on public.rooms, public.members, public.agents, public.messages from anon, authenticated;
grant select(id,name,created_at) on public.rooms to authenticated;
grant select on public.members,public.agents,public.messages to authenticated;
grant all on public.rooms,public.members,public.agents,public.messages to service_role;

create function public.create_room(p_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid; u uuid := auth.uid();
begin
 if u is null then raise exception 'Sign in first'; end if;
 if char_length(trim(p_name)) not between 1 and 60 or char_length(trim(p_display_name)) not between 1 and 32 then raise exception 'Invalid room or display name'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if (select count(*) from public.rooms where owner_id=u and created_at>now()-interval '1 hour')>=10 then raise exception 'Room limit reached. Try again later.'; end if;
 insert into public.rooms(name,owner_id) values(trim(p_name),u) returning id into r;
 insert into public.members values(r,u,trim(p_display_name));
 return r;
end $$;
create function public.join_room(p_room uuid,p_invite uuid,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if char_length(trim(p_display_name)) not between 1 and 32 then raise exception 'Enter a display name'; end if;
 if not exists(select 1 from public.rooms where id=p_room and invite_token=p_invite) then raise exception 'This invite is invalid.'; end if;
 insert into public.members values(p_room,auth.uid(),trim(p_display_name)) on conflict(room_id,user_id) do update set display_name=excluded.display_name;
 return p_room;
end $$;
create function public.room_invite(p_room uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member(p_room) then raise exception 'Room not found'; end if;
 return (select invite_token from public.rooms where id=p_room);
end $$;
create function public.submit_message(p_id uuid,p_room uuid,p_content text,p_agent text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n text; existing public.messages;
begin
 if u is null or not public.is_member(p_room) then raise exception 'Room not found'; end if;
 if char_length(trim(p_content)) not between 1 and 4000 then raise exception 'Messages must be 1-4000 characters'; end if;
 if p_agent is not null and p_agent not in ('paul','ravi','kaira') then raise exception 'Unknown agent'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_room::text,1));
 select * into existing from public.messages where id=p_id;
 if found then
   if existing.user_id=u and existing.room_id=p_room and existing.content=trim(p_content) then return p_id; end if;
   raise exception 'Request ID already used';
 end if;
 if (select count(*) from public.messages where user_id=u and created_at>now()-interval '1 minute')>=30 then raise exception 'Slow down a little. Try again in a minute.'; end if;
 if p_agent is not null and (select count(*) from public.messages where room_id=p_room and agent_id is not null and created_at>now()-interval '1 minute')>=12 then raise exception 'AI request limit reached. Try again in a minute.'; end if;
 select display_name into n from public.members where room_id=p_room and user_id=u;
 insert into public.messages(id,room_id,user_id,sender_name,content) values(p_id,p_room,u,n,trim(p_content));
 if p_agent is not null then
   insert into public.messages(room_id,sender_name,agent_id,parent_id,status) select p_room,name,id,p_id,'pending' from public.agents where id=p_agent;
 end if;
 return p_id;
end $$;
revoke all on function public.create_room(text,text),public.join_room(uuid,uuid,text),public.room_invite(uuid),public.submit_message(uuid,uuid,text,text) from public;
grant execute on function public.create_room(text,text),public.join_room(uuid,uuid,text),public.room_invite(uuid),public.submit_message(uuid,uuid,text,text) to authenticated;
alter publication supabase_realtime add table public.messages, public.members;
