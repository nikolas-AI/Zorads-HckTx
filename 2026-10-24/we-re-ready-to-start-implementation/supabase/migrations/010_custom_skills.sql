begin;
create or replace function public.save_studio_friend(p_id text,p_source text,p_config jsonb) returns text
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
 if cardinality(chosen)>6 or exists(select 1 from unnest(chosen) skill where skill not in ('research','nerdy','code-review','data-analysis','expert','teacher','tutor','creative','planner') and not (left(skill,7)='custom:' and char_length(substring(skill from 8)) between 1 and 120 and substring(skill from 8)=trim(substring(skill from 8)))) then raise exception 'Choose up to six available skills.'; end if;
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

NOTIFY pgrst, 'reload schema';
commit;
