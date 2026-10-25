import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const u1='11111111-1111-4111-8111-111111111111',u2='22222222-2222-4222-8222-222222222222';
test('migration, private rooms, joining, idempotency, rate limits and exclusive AI claims', async () => {
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role; create publication supabase_realtime; insert into auth.users values('${u1}'),('${u2}');`);
 await db.exec(await readFile('supabase/migrations/001_phase1.sql','utf8'));
 const asUser=async(id:string)=>{await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);};
 await asUser(u1);
 const room=(await db.query<{id:string}>(`select public.create_room('Weekend crew','Alex') as id`)).rows[0].id;
 const token=(await db.query<{token:string}>(`select public.room_invite($1) as token`,[room])).rows[0].token;
 await assert.rejects(db.query('select invite_token from public.rooms'),/permission denied/);
 await assert.rejects(db.query(`insert into public.messages(room_id,user_id,sender_name,content) values($1,$2,'fake','fake')`,[room,u1]),/permission denied/);
 const privateRoom=(await db.query<{id:string}>(`select public.create_room('Private','Alex') as id`)).rows[0].id;
 await db.query(`select public.submit_message(gen_random_uuid(),$1,'private message',null)`,[privateRoom]);
 await asUser(u2);
 assert.equal((await db.query('select id,name from public.rooms')).rows.length,0);
 assert.equal((await db.query('select * from public.messages')).rows.length,0);
 await assert.rejects(db.query(`select public.room_invite($1)`,[room]),/Room not found/);
 await assert.rejects(db.query(`select public.join_room($1,gen_random_uuid(),'Bea')`,[room]),/invalid/);
 await assert.rejects(db.query(`select public.submit_message(gen_random_uuid(),$1,'Hello',null)`,[room]),/Room not found/);
 await db.query(`select public.join_room($1,$2,'Bea')`,[room,token]);
 assert.equal((await db.query('select id,name from public.rooms')).rows.length,1);
 const message='33333333-3333-4333-8333-333333333333';
 await db.query(`select public.submit_message($1,$2,'@Paul hello','paul')`,[message,room]);
 await db.query(`select public.submit_message($1,$2,'@Paul hello','paul')`,[message,room]);
 assert.equal((await db.query('select * from public.messages')).rows.length,2);
 await assert.rejects(db.query(`select public.submit_message($1,$2,'different','paul')`,[message,room]),/already used/);
 await asUser(u1);
 await assert.rejects(db.query(`select public.submit_message($1,$2,'@Paul hello','paul')`,[message,room]),/already used/);
 assert.equal((await db.query('select * from public.messages')).rows.length,3);
 await db.exec('reset role; set role service_role;');
 const claim=()=>db.query(`update public.messages set status='generating' where parent_id=$1 and status='pending' returning id`,[message]);
 assert.equal((await claim()).rows.length,1); assert.equal((await claim()).rows.length,0);
 await asUser(u2);
 for(let i=0;i<11;i++) await db.query(`select public.submit_message(gen_random_uuid(),$1,'@Paul hi','paul')`,[room]);
 await assert.rejects(db.query(`select public.submit_message(gen_random_uuid(),$1,'@Paul hi','paul')`,[room]),/AI request limit/);
 for(let i=0;i<18;i++) await db.query(`select public.submit_message(gen_random_uuid(),$1,'human chat',null)`,[room]);
 await assert.rejects(db.query(`select public.submit_message(gen_random_uuid(),$1,'too fast',null)`,[room]),/Slow down/);
 await db.exec('reset role; set role anon;');
 await assert.rejects(db.query('select * from public.messages'),/permission denied/);
 await assert.rejects(db.query(`select public.create_room('no','no')`),/permission denied/);
 } finally { await db.close(); }
});

