import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeRoomMessage} from '../src/lib/routing';
const zorad={id:'zorad',name:'Zorad'};
test('Zorad requires an explicit mention even when alone in a private chat',()=>{
 for(const aiOnly of [false,true]) {
  for(const text of ['Hi','Zorad, help me','dig deeper']) assert.equal(routeRoomMessage(text,[],'u',[],[zorad],aiOnly).agentId,null);
  assert.equal(routeRoomMessage('@Zorad help',[],'u',[],[zorad],aiOnly).agentId,'zorad');
 }
});
test('a private companion still replies normally alongside quiet Zorad',()=>{
 const roster=[zorad,{id:'custom-nova',name:'Nova'}];
 assert.equal(routeRoomMessage('Hi',[],'u',[],roster,true).agentId,'custom-nova');
 assert.equal(routeRoomMessage('@Zorad hi',[],'u',[],roster,true).agentId,'zorad');
});
