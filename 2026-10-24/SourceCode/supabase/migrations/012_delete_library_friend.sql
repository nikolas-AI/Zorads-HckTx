begin;
create function public.delete_library_friend(p_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 update public.agents set archived=true,allow_template=false
 where id=p_id and owner_id=auth.uid() and room_id is null and not archived;
 if not found then raise exception 'Only the creator can delete this library friend.'; end if;
 update public.agents set allow_template=false where source_id=p_id;
end $$;
revoke all on function public.delete_library_friend(text) from public,anon;
grant execute on function public.delete_library_friend(text) to authenticated;
NOTIFY pgrst, 'reload schema';
commit;
