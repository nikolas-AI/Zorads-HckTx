import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const user='11111111-1111-4111-8111-111111111111', outsider='22222222-2222-4222-8222-222222222222';
test('Phase 2 migration isolates logs, freezes routing, checks references, and finishes atomically',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role; create publication supabase_realtime; insert into auth.users values('${user}'),('${outsider}');`);
 for(const file of ['001_phase1.sql','002_conversational_routing.sql']) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
 const room=(await db.query<{id:string}>(`select public.create_room('Room','Sam') id`)).rows[0].id;
 const other=(await db.query<{id:string}>(`select public.create_room('Other','Sam') id`)).rows[0].id;
 const request='33333333-3333-4333-8333-333333333333';
 const route={agentId:'ravi',complexity:'MEDIUM',escalate:false,replyToId:null,clarify:false,reason:'Named friend'};
 await assert.rejects(db.query(`select public.submit_routed_message($1,$2,$3,'Ravi compare', $4)`,[request,room,user,JSON.stringify(route)]),/permission denied/);
 await db.exec('reset role; set role service_role;');
 await assert.rejects(db.query(`select public.submit_routed_message($1,$2,$3,'Ravi compare', $4)`,[request,room,outsider,JSON.stringify(route)]),/Room not found/);
 await db.query(`select public.submit_routed_message($1,$2,$3,'Ravi compare', $4)`,[request,room,user,JSON.stringify(route)]);
 await db.query(`select public.submit_routed_message($1,$2,$3,'Ravi compare', $4)`,[request,room,user,JSON.stringify({...route,complexity:'HIGH'})]);
 const saved=(await db.query<{routing:typeof route}>(`select routing from public.messages where id=$1`,[request])).rows[0];
 assert.equal(saved.routing.complexity,'MEDIUM');
 assert.equal((await db.query(`select * from public.messages`)).rows.length,2);
 const reply=(await db.query<{id:string}>(`update public.messages set status='generating' where parent_id=$1 and status='pending' returning id`,[request])).rows[0].id;
 assert.equal((await db.query(`update public.messages set status='generating' where parent_id=$1 and status='pending' returning id`,[request])).rows.length,0);
 const attempt=(await db.query<{id:string}>(`insert into public.ai_attempts(room_id,reply_id,attempt,agent_id,model,complexity,reason) values($1,$2,1,'ravi','test-model','MEDIUM','Named') returning id`,[room,reply])).rows[0].id;
 await assert.rejects(db.query(`select public.finish_ai_attempt($1,'complete',10,20,.01,.02,100,null,'answer','invalid')`,[attempt]),/Invalid reply/);
 assert.equal((await db.query<{status:string}>(`select status from public.ai_attempts where id=$1`,[attempt])).rows[0].status,'running');
 await db.query(`select public.finish_ai_attempt($1,'complete',10,20,.01,.02,100,null,'answer','complete')`,[attempt]);
 await assert.rejects(db.query(`select public.finish_ai_attempt($1,'complete',10,20,.01,.02,100,null,'duplicate','complete')`,[attempt]),/not running/);
 assert.equal((await db.query<{content:string}>(`select content from public.messages where id=$1`,[reply])).rows[0].content,'answer');
 await assert.rejects(db.query(`select public.submit_routed_message(gen_random_uuid(),$1,$2,'Ravi dig deeper', $3)`,[other,user,JSON.stringify({...route,replyToId:reply})]),/Invalid earlier reply/);
 await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${outsider}',false);`);
 assert.equal((await db.query('select * from public.ai_attempts')).rows.length,0);
 await db.exec(`select set_config('request.jwt.claim.sub','${user}',false);`);
 assert.equal((await db.query('select * from public.ai_attempts')).rows.length,1);
 await assert.rejects(db.query(`update public.ai_attempts set estimated_cost=0`),/permission denied/);
 }finally{await db.close();}
});
