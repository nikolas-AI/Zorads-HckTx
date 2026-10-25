begin;
create or replace function public.start_friend_chat(p_friends text[],p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r uuid; f text;
begin
 if cardinality(p_friends) is null or cardinality(p_friends) not between 1 and 5 then raise exception 'Select one to five friends.'; end if;
 if cardinality(p_friends)<>(select count(distinct x) from unnest(p_friends) x) then raise exception 'Choose each friend once.'; end if;
 r:=public.create_room(case when cardinality(p_friends)=1 then coalesce((select name from public.agents where id=p_friends[1]),'friend') else 'My AI circle' end,p_display_name);
 update public.rooms set ai_only=true where id=r;
 foreach f in array p_friends loop perform public.add_friend_to_room(f,r); end loop;
 return r;
end $$;
revoke all on function public.start_friend_chat(text[],text) from public,anon;
grant execute on function public.start_friend_chat(text[],text) to authenticated;

NOTIFY pgrst, 'reload schema';
commit;
