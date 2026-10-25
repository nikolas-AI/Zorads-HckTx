import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { routeMessage } from '../src/lib/routing';
import type { Message } from '../src/lib/types';
const user='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
test('custom names route only to the current roster, with bounded mentions and safe follow-ups',()=>{
 const agents=[{id:'custom-1',name:'Nova'},{id:'custom-2',name:'DJ-Star'}];
 const route=(text:string, roster=agents)=>routeMessage(text,[],user,[],Date.now(),roster);
 assert.equal(route('@Nova hello').agentId,'custom-1');
 assert.equal(route('Hey Nova, ideas?').agentId,'custom-1');
 assert.equal(route('@DJ-Star, music?').agentId,'custom-2');
 assert.equal(route('@Nova2 hello').agentId,null);
 assert.equal(route('@Nova hello',[]).agentId,null);
 assert.equal(routeMessage('Nova, hello',[],user,['Nova'],Date.now(),agents).agentId,null);
 assert.equal(routeMessage('@Nova hello',[],user,['Nova'],Date.now(),agents).agentId,'custom-1');
 const base={room_id:'room',sender_name:'Sam',content:'Hello',created_at:new Date().toISOString(),status:'complete' as const};
 const history:Message[]=[{...base,id:'q',parent_id:null,user_id:user,agent_id:null},{...base,id:'a',user_id:null,parent_id:'q',agent_id:'custom-1'}];
 assert.equal(routeMessage('dig deeper',history,user,[],Date.now(),agents).agentId,'custom-1');
 assert.equal(routeMessage('dig deeper',history,user,[],Date.now(),[]).agentId,null);
});
test('Studio migration protects ownership and room access, routes custom agents, and preserves history',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role; create publication supabase_realtime; insert into auth.users values('${user}'),('${other}');`);
 for(const file of ['001_phase1.sql','002_conversational_routing.sql','003_agent_studio.sql']) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
 const room=(await db.query<{id:string}>(`select public.create_room('Room','Sam') id`)).rows[0].id;
 const second=(await db.query<{id:string}>(`select public.create_room('Second','Sam') id`)).rows[0].id;
 const save=(r:string,id:string|null,name='Nova')=>db.query<{id:string}>(`select public.save_friend($1,$2,$3,'Warm and curious','Music','✦','Keep it short') id`,[r,id,name]);
 const id=(await save(room,null)).rows[0].id;
 await assert.rejects(save(room,null,'nova'),/already uses/);
 await assert.rejects(save(room,null,'Paul'),/already uses/);
 await assert.rejects(save(room,null,'Bad name'),/Use a name/);
 await assert.rejects(save(room,'ravi'),/Only the creator/);
 await save(second,null); // Same name in a different room is safe.
 await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
 assert.equal((await db.query(`select * from public.agents where room_id is not null`)).rows.length,0);
 await assert.rejects(save(room,null,'Aster'),/Room not found/);
 await db.exec(`reset role; insert into public.members values('${room}','${other}','Taylor'); set role authenticated;`);
 assert.equal((await db.query(`select * from public.agents where room_id is not null`)).rows.length,1);
 await assert.rejects(save(room,id),/Only the creator/);
 await assert.rejects(db.query('select public.remove_friend($1,$2)',[room,id]),/Only the creator/);
 await assert.rejects(db.query(`update public.agents set personality='oops' where id=$1`,[id]),/permission denied/);
 await db.exec(`reset role; set role service_role;`);
 const request='33333333-3333-4333-8333-333333333333';
 const route=JSON.stringify({agentId:id,complexity:'LOW',replyToId:null});
 await assert.rejects(db.query(`select public.submit_routed_message(gen_random_uuid(),$1,$2,'@Nova hi',$3)`,[second,user,route]),/not available/);
 await db.query(`select public.submit_routed_message($1,$2,$3,'@Nova hi',$4)`,[request,room,user,route]);
 assert.equal((await db.query<{sender_name:string}>('select sender_name from public.messages where parent_id=$1',[request])).rows[0].sender_name,'Nova');
 await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
 await save(room,id,'Aster');
 await db.query('select public.remove_friend($1,$2)',[room,id]);
 assert.equal((await db.query('select * from public.messages where parent_id=$1',[request])).rows.length,1);
 await db.exec(`reset role; set role service_role;`);
 await assert.rejects(db.query(`select public.submit_routed_message(gen_random_uuid(),$1,$2,'@Nova hi',$3)`,[room,user,route]),/not available/);
 await db.query(`select public.submit_routed_message($1,$2,$3,'@Nova hi',$4)`,[request,room,user,route]); // Existing send remains idempotent after removal.
 await db.exec(`reset role; set role anon;`);
 await assert.rejects(save(room,null),/permission denied/);
 } finally {await db.close();}
});

