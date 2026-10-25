import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mentionedAgent } from '../src/lib/routing';
import { GeminiProvider } from '../src/lib/providers';
test('mentions are explicit, case insensitive, bounded and select only one agent',()=>{
 assert.equal(mentionedAgent('LOL that is crazy'),null);
 assert.equal(mentionedAgent('Guys where should we eat?'),null);
 assert.equal(mentionedAgent('@PAUL, any ideas?'),'paul');
 assert.equal(mentionedAgent('Hi @Ravi compare these'),'ravi');
 assert.equal(mentionedAgent('@Kaira @Paul plan Saturday'),'kaira');
 assert.equal(mentionedAgent('email@paul.com'),null);
 assert.equal(mentionedAgent('@pauline hi'),null);
});
test('Gemini adapter sends server key, personality and context, reads usage and exposes failures',async()=>{
 const original=global.fetch, key=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY='test-only-not-a-real-key';
 try {
  global.fetch=async(input,init)=>{
   assert.match(String(input),/^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/.+:generateContent$/);
   assert.equal((init?.headers as Record<string,string>)['x-goog-api-key'],'test-only-not-a-real-key');
   const body=JSON.parse(init?.body as string);
   assert.equal(body.systemInstruction.parts[0].text,'Be Paul');
   assert.equal(body.contents[0].parts[0].text,'Group context');
   return Response.json({candidates:[{content:{parts:[{text:'private thought',thought:true},{text:'Try white sneakers.'}]}}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:5,thoughtsTokenCount:7}});
  };
  const result=await new GeminiProvider().generate('Be Paul','Group context');
  assert.equal(result.text,'Try white sneakers.'); assert.equal(result.inputTokens,20);assert.equal(result.outputTokens,12);
  global.fetch=async()=>new Response('',{status:429});
  await assert.rejects(new GeminiProvider().generate('',''),/busy/);
  global.fetch=async()=>Response.json({candidates:[]});
  await assert.rejects(new GeminiProvider().generate('',''),/rephrasing/);
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(new GeminiProvider().generate('',''),/not configured/);
 } finally {global.fetch=original;if(key)process.env.GEMINI_API_KEY=key;else delete process.env.GEMINI_API_KEY;}
});

