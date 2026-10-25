"use client";
import {useState,type FormEvent} from 'react';
import {saveStudioFriend} from '@/lib/agent-repository';
import {blankFriend,type FriendConfig} from '@/lib/friend-presets';
import type {Agent} from '@/lib/types';
export function useAgentEditor(onSaved:(id:string)=>Promise<void>) {
 const [editing,setEditing]=useState<string|null>(null);
 const [source,setSource]=useState<string|null>(null);
 const [form,setForm]=useState<FriendConfig>(blankFriend);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 function start(agent?:Agent,copy=false,preset?:FriendConfig) {
  setEditing(agent && !copy ? agent.id:null);setSource(copy && agent ? agent.id:null);setError('');
  setForm(agent ? {name:copy ? `${agent.name.slice(0,19)}Copy`:agent.name,avatar:agent.avatar,specialty:agent.specialty,personality:agent.personality,system_prompt:agent.system_prompt,skills:agent.skills||[],allow_template:copy?false:Boolean(agent.allow_template),allow_group_edit:copy?false:Boolean(agent.allow_group_edit)} : {...(preset||blankFriend),skills:[...(preset?.skills||[])]});
 }
 async function save(event:FormEvent) {
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{const id=await saveStudioFriend(editing,source,form);await onSaved(id);}catch(e){setError(e instanceof Error?e.message:'Could not save your friend.');}finally{setBusy(false);}
 }
 return {editing,form,setForm,busy,error,start,save};
}
