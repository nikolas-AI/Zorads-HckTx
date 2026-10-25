-- Additive Phase 2 migration. Apply after 001; existing messages are preserved.
begin;
alter table public.messages add column routing jsonb;
create table public.ai_attempts (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 reply_id uuid not null references public.messages(id) on delete cascade, attempt integer not null check(attempt between 1 and 2),
 agent_id text not null references public.agents(id), model text not null, provider text not null default 'gemini',
 complexity text not null check(complexity in ('LOW','MEDIUM','HIGH')), reason text not null,
 reply_to_id uuid references public.messages(id), escalated boolean not null default false,
 status text not null default 'running' check(status in ('running','complete','failed')),
 input_tokens integer, output_tokens integer, estimated_cost numeric, baseline_cost numeric,
 input_price numeric, output_price numeric, baseline_model text, baseline_input_price numeric, baseline_output_price numeric,
 latency_ms integer, error text, created_at timestamptz not null default now(),
 unique(reply_id,attempt)
);
create index ai_attempts_room_time on public.ai_attempts(room_id,created_at desc);
alter table public.ai_attempts enable row level security;
create policy attempts_read on public.ai_attempts for select to authenticated using(public.is_member(room_id));
revoke all on public.ai_attempts from anon,authenticated;
grant select on public.ai_attempts to authenticated;
grant all on public.ai_attempts to service_role;
alter publication supabase_realtime add table public.ai_attempts;

-- Called only by the authenticated server route. Routing is frozen under the same
-- per-user/per-room locks as Phase 1 submissions, before a model can be claimed.
create function public.submit_routed_message(p_id uuid,p_room uuid,p_user uuid,p_content text,p_routing jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare n text; existing public.messages; a text:=p_routing->>'agentId'; prior uuid:=nullif(p_routing->>'replyToId','')::uuid;
begin
 if p_user is null or not exists(select 1 from public.members where room_id=p_room and user_id=p_user) then raise exception 'Room not found'; end if;
 if p_content is null or char_length(trim(p_content)) not between 1 and 4000 then raise exception 'Messages must be 1-4000 characters'; end if;
 if p_routing is null or p_routing->>'complexity' is null or p_routing->>'complexity' not in ('LOW','MEDIUM','HIGH') then raise exception 'Invalid routing'; end if;
 if a is not null and a not in ('paul','ravi','kaira') then raise exception 'Unknown agent'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_room::text,1));
 select * into existing from public.messages where id=p_id;
 if found then
   if existing.user_id=p_user and existing.room_id=p_room and existing.content=trim(p_content) then return p_id; end if;
   raise exception 'Request ID already used';
 end if;
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

-- Persist billed usage and the visible reply together, after inference finishes.
create function public.finish_ai_attempt(p_id uuid,p_status text,p_input integer,p_output integer,p_cost numeric,p_baseline numeric,p_latency integer,p_error text,p_content text,p_reply_status text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.ai_attempts;
begin
 select * into a from public.ai_attempts where id=p_id for update;
 if not found or a.status<>'running' then raise exception 'Attempt is not running'; end if;
 if p_status not in ('complete','failed') then raise exception 'Invalid attempt status'; end if;
 update public.ai_attempts set status=p_status,input_tokens=p_input,output_tokens=p_output,estimated_cost=p_cost,baseline_cost=p_baseline,latency_ms=p_latency,error=p_error where id=p_id;
 if p_reply_status is not null then
   if p_reply_status not in ('complete','failed') then raise exception 'Invalid reply status'; end if;
   update public.messages set content=p_content,status=p_reply_status,model=a.model,input_tokens=p_input,output_tokens=p_output where id=a.reply_id;
 end if;
end $$;
revoke all on function public.finish_ai_attempt(uuid,text,integer,integer,numeric,numeric,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_ai_attempt(uuid,text,integer,integer,numeric,numeric,integer,text,text,text) to service_role;
commit;
