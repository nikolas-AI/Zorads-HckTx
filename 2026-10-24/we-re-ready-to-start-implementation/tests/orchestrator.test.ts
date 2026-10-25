import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateReply } from '../src/lib/orchestrator';
import { ProviderError } from '../src/lib/providers';
import type { Message } from '../src/lib/types';
import type { RoutingDecision } from '../src/lib/routing';

type Row=Record<string, any>;
function fakeDb(request: Row, prior: Row[] = []) {
 const tables:Record<string,Row[]>={messages:[...prior,request,{id:'reply',parent_id:request.id,room_id:request.room_id,agent_id:'ravi',status:'pending'}],agents:[{id:'ravi',system_prompt:'Be Ravi'}],ai_attempts:[]};
 class Query {
  filters: Array<(row:Row)=>boolean>=[]; action='select'; values:Row={}; limitCount=Infinity;
  constructor(private table:string){}
  select(){return this;} update(values:Row){this.action='update';this.values=values;return this;} insert(values:Row){this.action='insert';this.values=values;return this;}
  eq(key:string,value:unknown){this.filters.push(row=>row[key]===value);return this;}
  lte(key:string,value:string){this.filters.push(row=>row[key]<=value);return this;}
  order(){return this;} limit(n:number){this.limitCount=n;return this;}
  execute(){let rows=tables[this.table].filter(row=>this.filters.every(f=>f(row))).slice(0,this.limitCount);if(this.action==='insert'){const row={id:`attempt-${tables[this.table].length}`,status:'running',...this.values};tables[this.table].push(row);rows=[row];}if(this.action==='update')rows.forEach(row=>Object.assign(row,this.values));return {data:rows,error:null};}
  single(){const result=this.execute();return Promise.resolve({data:result.data[0]||null,error:result.data.length?null:new Error('Missing row')});}
  maybeSingle(){const result=this.execute();return Promise.resolve({data:result.data[0]||null,error:null});}
  then(resolve:any,reject:any){return Promise.resolve(this.execute()).then(resolve,reject);}
 }
 const client={from:(table:string)=>new Query(table),rpc:async(_name:string,args:Row)=>{
  const attempt=tables.ai_attempts.find(a=>a.id===args.p_id)!;
  Object.assign(attempt,{status:args.p_status,input_tokens:args.p_input,output_tokens:args.p_output,estimated_cost:args.p_cost,baseline_cost:args.p_baseline});
  if(args.p_reply_status) Object.assign(tables.messages.find(m=>m.id===attempt.reply_id)!,{content:args.p_content,status:args.p_reply_status,model:attempt.model});
  return {error:null};
 }};
 return {admin:client as unknown as SupabaseClient,tables};
}
const route:RoutingDecision={agentId:'ravi',complexity:'MEDIUM',escalate:false,replyToId:null,clarify:false,reason:'Named friend'};
const request={id:'request',room_id:'room',user_id:'user',sender_name:'Alex',agent_id:null,content:'Ravi compare cabins',status:'complete',created_at:new Date().toISOString(),parent_id:null,routing:route} as Message & {routing:RoutingDecision};
test('concurrent sends have one model owner; context and logs stay room scoped',async()=>{
 const {admin,tables}=fakeDb(request);
 let calls=0;
 const provider={generate:async(system:string,context:string)=>{calls++;assert.match(system,/Be Ravi/);assert.match(context,/Ravi compare cabins/);return {text:'Cabins are cozy.',model:'test',inputTokens:10,outputTokens:20};}};
 await Promise.all([generateReply(admin,request,provider),generateReply(admin,request,provider)]);
 assert.equal(calls,1);assert.equal(tables.ai_attempts.length,1);assert.equal(tables.ai_attempts[0].status,'complete');assert.equal(tables.messages.at(-1)?.status,'complete');
});
test('definite rejection uses exactly one configured fallback and logs both attempts',async()=>{
 const previous=process.env.GEMINI_FALLBACK_MODEL;process.env.GEMINI_FALLBACK_MODEL='gemini-3.5-flash-lite';
 try{
 const {admin,tables}=fakeDb(request);let calls=0;
 await generateReply(admin,request,{generate:async()=>{calls++;if(calls===1)throw new ProviderError('Busy',true);return {text:'A useful answer.',model:'fallback',inputTokens:2,outputTokens:3};}});
 assert.equal(calls,2);assert.deepEqual(tables.ai_attempts.map(a=>a.status),['failed','complete']);assert.equal(tables.ai_attempts[0].estimated_cost,null);
 }finally{if(previous===undefined)delete process.env.GEMINI_FALLBACK_MODEL;else process.env.GEMINI_FALLBACK_MODEL=previous;}
});
test('ambiguous network failures never retry and leave a visible failure',async()=>{
 const previous=process.env.GEMINI_FALLBACK_MODEL;process.env.GEMINI_FALLBACK_MODEL='gemini-3.5-flash-lite';
 try{
 const {admin,tables}=fakeDb(request);let calls=0;
 await generateReply(admin,request,{generate:async()=>{calls++;throw new ProviderError('Connection interrupted');}});
 assert.equal(calls,1);assert.equal(tables.messages.at(-1)?.status,'failed');assert.equal(tables.ai_attempts[0].status,'failed');
 }finally{if(previous===undefined)delete process.env.GEMINI_FALLBACK_MODEL;else process.env.GEMINI_FALLBACK_MODEL=previous;}
});
test('deeper follow-up retrieves original request and preserves the prior answer',async()=>{
 const oldQuestion={...request,id:'old-q',content:'Original budget question',routing:undefined};
 const oldAnswer={...request,id:'old-a',parent_id:'old-q',agent_id:'ravi',user_id:null,content:'Original answer',model:'gemini-3.5-flash-lite'};
 const follow={...request,content:'Ravi dig deeper',routing:{...route,replyToId:'old-a',escalate:true}};
 const {admin,tables}=fakeDb(follow,[oldQuestion,oldAnswer]);
 await generateReply(admin,follow,{generate:async(_system,context,model)=>{assert.ok(model!.rank>0);const data=JSON.parse(context);assert.equal(data.originalQuestion,'Original budget question');assert.equal(data.earlierAnswer,'Original answer');return {text:'Improved answer',model:model!.id,inputTokens:3,outputTokens:4};}});
 assert.equal(tables.messages.find(m=>m.id==='old-a')?.content,'Original answer');assert.equal(tables.ai_attempts[0].escalated,true);
});

test('custom friend profile reaches real orchestration as lower-trust customization',async()=>{
 const customRequest={...request,routing:{...route,agentId:'custom-1'}};
 const {admin,tables}=fakeDb(customRequest);
 tables.messages.at(-1)!.agent_id='custom-1';
 tables.agents=[{id:'custom-1',room_id:'room',name:'Nova',personality:'Warm and witty',specialty:'Indie music',system_prompt:'Suggest affordable concerts'}];
 let called=false;
 await generateReply(admin,customRequest,{generate:async(system)=>{
  called=true;assert.match(system,/untrusted customization/);assert.match(system,/Warm and witty/);assert.match(system,/Indie music/);assert.match(system,/Suggest affordable concerts/);assert.match(system,/Do not impersonate/);
  return {text:'Let’s find your next favorite band.',model:'test',inputTokens:3,outputTokens:4};
 }});
 assert.equal(called,true);assert.equal(tables.ai_attempts[0].agent_id,'custom-1');assert.equal(tables.messages.at(-1)!.status,'complete');
});
