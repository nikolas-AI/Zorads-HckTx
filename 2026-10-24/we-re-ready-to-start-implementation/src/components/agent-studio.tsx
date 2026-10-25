"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft, Plus, Sparkles, Search, MessageCircle, Users, ShieldCheck, Copy, Pencil, Check, Globe, Code2, X, Cpu} from 'lucide-react';
import {identity} from '@/lib/identity';
import {browserDb,configured} from '@/lib/supabase';
import {addToRoom,startFriendChat,removeFriend} from '@/lib/agent-repository';
import {useAgentEditor} from '@/hooks/use-agent-editor';
import {templates,skills,type FriendConfig} from '@/lib/friend-presets';
import type {Agent,Room} from '@/lib/types';
import AgentPreview from './agent-preview';
import {restorePreferences} from '@/lib/chat-preferences';
import './chat.css';
import './friend-studio.css';
const avatars=['✦','☀','☾','♫','✿','⚡','♥','●','⌘','⌕','✧','▥'];
type View='library'|'templates'|'profile'|'editor';
export default function AgentStudio() {
 const [user,setUser]=useState(''),[agents,setAgents]=useState<Agent[]>([]),[rooms,setRooms]=useState<Room[]>([]);
 const [view,setView]=useState<View>('editor'),[selected,setSelected]=useState<string|null>(null),[contextRoom,setContextRoom]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[working,setWorking]=useState(false);
 const [search,setSearch]=useState(''),[chatSelection,setChatSelection]=useState<string[]>([]),[targetRoom,setTargetRoom]=useState('');
 async function load() {
  const db=browserDb();
  const [a,r]=await Promise.all([db.from('agents').select('*'),db.from('rooms').select('id,name,created_at,ai_only').order('created_at',{ascending:false})]);
  if(a.error||r.error)throw new Error('Could not load your library. Apply migration 004 and check your connection.');
  setAgents(a.data||[]);setRooms(r.data||[]);
 }
 const editor=useAgentEditor(async id=>{await load();setSelected(id);setView('profile');setNotice('Saved. Your friend is ready.');});
 useEffect(()=>{
  let active=true;
  const params=new URLSearchParams(location.search);const room=params.get('room')||'';setContextRoom(room);setTargetRoom(room);
  const friend=params.get('friend');if(friend){setSelected(friend);setView('profile');}
  if(!configured){setError('Configure Supabase to save friends. You can explore the templates below.');setLoading(false);setView('templates');return;}
  void(async()=>{try{const current=await identity();if(!active)return;setUser(current.id);await load();}catch(e){if(active)setError(e instanceof Error?e.message:'Could not connect.');}finally{if(active)setLoading(false);}})();
  return()=>{active=false;};
 },[]);
 const workspace=useRef<HTMLDivElement>(null);
 useEffect(restorePreferences,[]);
 useEffect(()=>{workspace.current?.scrollTo({top:0});},[view]);
 const selectedAgent=agents.find(a=>a.id===selected);
 const library=agents.filter(a=>a.owner_id===user&&!a.room_id&&!a.archived);
 const filtered=library.filter(a=>(a.name+' '+a.specialty).toLowerCase().includes(search.toLowerCase()));
 const own=selectedAgent?.owner_id===user;
 const groupVersion=Boolean(selectedAgent?.room_id);
 const editable=Boolean(selectedAgent?.owner_id&&(own||(groupVersion&&selectedAgent.allow_group_edit))&&!selectedAgent.archived);
 const copyable=Boolean(selectedAgent&&!selectedAgent.archived&&(own||selectedAgent.allow_template));
 function open(agent:Agent){setSelected(agent.id);setView('profile');setError('');setNotice('');}
 function create(preset?:FriendConfig){editor.start(undefined,false,preset);setView('editor');setError('');setNotice('');}
 function edit(copy=false){if(!selectedAgent)return;editor.start(selectedAgent,copy);setView('editor');setError('');setNotice('');}
 async function action(work:()=>Promise<void>){if(working)return;setWorking(true);setError('');setNotice('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Could not finish.');}finally{setWorking(false);}}
 function chat(ids:string[]){void action(async()=>{const room=await startFriendChat(ids,localStorage.getItem('friends-name')?.trim()||'You');location.assign('/chat?'+new URLSearchParams({room}));});}
 const back=contextRoom?'/chat?'+new URLSearchParams({room:contextRoom}):'/chat';
 const editingGroup=Boolean(editor.editing&&agents.find(a=>a.id===editor.editing)?.room_id);
 const locked=working||editor.busy;
 return <main className="chat-workspace studio-page">
  <section className="studio agent-builder studio-standalone" aria-labelledby="studio-title">
   <header className="builder-header"><button className="builder-back" type="button" aria-label={view==='editor'&&editor.editing?'Back to profile':'Back to chats'} disabled={locked} onClick={()=>view==='editor'&&editor.editing?setView('profile'):location.assign(back)}><ArrowLeft size={20}/></button><div><h2 id="studio-title">{view==='editor'?(editingGroup?'Customize for this group':editor.editing?'Edit your AI friend':'Create an AI friend'):view==='templates'?'Friend templates':view==='profile'?selectedAgent?.name||'Friend profile':'Your AI friends'}</h2></div><button aria-label="Close AI friend creator" disabled={locked} onClick={()=>location.assign(back)}><X size={20}/></button></header>
   {error&&<div className="studio-feedback error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}{notice&&<p className="studio-feedback studio-notice" role="status">{notice}</p>}
   <div className="builder-workspace" ref={workspace}>
    <nav className="builder-library" aria-label="Friend Studio">
     <button className={view==='editor'&&!editor.editing?'selected':''} disabled={locked} onClick={()=>create()}><Plus size={18}/>New friend</button>
     <button className={view==='library'?'selected':''} disabled={locked} onClick={()=>setView('library')}><Users size={18}/>My friends</button>
     <button className={view==='templates'?'selected':''} disabled={locked} onClick={()=>setView('templates')}><Sparkles size={18}/>Templates</button>
     {agents.filter(a=>a.id==='zorad').map(a=><button key={a.id} disabled={locked} onClick={()=>open(a)}><span>{a.avatar}</span><span>Zorad<small>Built-in companion</small></span></button>)}
     <h3>Your creations</h3>{library.map(a=><button key={a.id} className={selected===a.id&&view==='profile'?'selected':''} disabled={locked} onClick={()=>open(a)}><span>{a.avatar}</span><span>{a.name}<small>Created by you</small></span></button>)}
     {!loading&&!library.length&&<p>Your friends will appear here once you create them.</p>}
     <div className="builder-library-note"><Sparkles size={18}/><p>Create a friend. Bring them into your conversations.</p></div>
    </nav>
    {(view==='library'||view==='templates')&&<section className="builder-collection"><div className="builder-section-heading"><div><h3>{view==='templates'?'Start with a template':'Your creations'}</h3><p>{view==='templates'?'Choose a starting point, then customize it to make it yours.':'Add your friends to groups or select a few for a private AI chat.'}</p></div></div>
     {view==='library'&&<label className="builder-search"><Search size={18}/><input aria-label="Search your friends" placeholder="Search your friends" value={search} onChange={e=>setSearch(e.target.value)}/></label>}
     {loading&&<p role="status" className="builder-help">Loading your library…</p>}
     {view==='templates'?<div className="builder-card-grid">{templates.map(t=><button className="builder-template-card" key={t.id} onClick={()=>create(t.config)}><span className="builder-card-avatar">{t.config.avatar}</span><strong>{t.title}</strong><p>{t.description}</p><span className="builder-tags">{t.config.skills.map(id=><span key={id}>{skills.find(s=>s.id===id)?.name}</span>)}</span><span className="builder-card-action">Customize template <Pencil size={14}/></span></button>)}</div>:<>
      {!loading&&!filtered.length&&<div className="builder-empty"><Users size={26}/><h3>{library.length?'No matching friends':'Create your first AI friend'}</h3><p>{library.length?'Try another name or interest.':'Start from scratch or customize a template.'}</p><button className="button" onClick={()=>setView('templates')}>Browse templates</button></div>}
      <div className="builder-card-grid">{filtered.map(a=><article className="builder-friend-card" key={a.id}><button onClick={()=>open(a)}><span className="builder-card-avatar">{a.avatar}</span><strong>{a.name}<span className="ai-badge">AI</span></strong><p>{a.specialty}</p><span className="builder-tags">{(a.skills||[]).map(id=><span key={id}>{skills.find(s=>s.id===id)?.name}</span>)}</span><span className="builder-card-action">View profile</span></button><label className="builder-chat-select"><input type="checkbox" checked={chatSelection.includes(a.id)} disabled={!chatSelection.includes(a.id)&&chatSelection.length>=5} onChange={e=>setChatSelection(old=>e.target.checked?[...old,a.id]:old.filter(id=>id!==a.id))}/>Include {a.name} in a private chat</label></article>)}</div>
      {chatSelection.length>0&&<div className="builder-chat-tray"><span>{chatSelection.length} selected · Just you and AI</span><button className="button" disabled={working} onClick={()=>chat(chatSelection)}><MessageCircle size={16}/>{working?'Opening…':'Start chat'}</button><button disabled={working} onClick={()=>setChatSelection([])}>Clear</button></div>}
     </>}
    </section>}
    {view==='profile'&&(selectedAgent?<>
     <section className="builder-form builder-profile"><span className="builder-card-avatar profile-avatar">{selectedAgent.avatar}</span><span className="builder-eyebrow">{groupVersion?'GROUP VERSION':own?'YOUR ORIGINAL FRIEND':'BUILT-IN FRIEND'}</span><h3>{selectedAgent.name} <span className="ai-badge">AI</span></h3><p>{selectedAgent.specialty}</p>{selectedAgent.id==='zorad'&&<p className="builder-help">Included in every chat. Replies only to @Zorad. Cannot be edited or removed; use as a template to make your own companion.</p>}<div className="builder-tags">{(selectedAgent.skills||[]).map(id=><span key={id}>{skills.find(s=>s.id===id)?.name}</span>)}</div><section className="builder-section"><h4>Personality</h4><p>{selectedAgent.personality}</p></section>{selectedAgent.system_prompt&&<section className="builder-section"><h4>Custom instructions</h4><p className="builder-instructions">{selectedAgent.system_prompt}</p></section>}<footer className="builder-footer">{editable&&<button className="primary" onClick={()=>edit()}><Pencil size={16}/>{groupVersion?'Customize group version':'Edit friend'}</button>}{copyable&&<button className="button" onClick={()=>edit(true)}><Copy size={16}/>Use as template</button>}</footer>{!copyable&&<p className="builder-help">The creator hasn’t enabled template copying.</p>}</section>
     <aside className="builder-preview builder-profile-actions"><ShieldCheck size={24}/><h3>{groupVersion?'Only for this group':'Add to your conversations'}</h3><p>{groupVersion?'Edits here stay in this group. The Studio original stays unchanged.':'Each group gets its own version. Later edits to your original won’t overwrite group customizations.'}</p><div className="builder-preview-about"><h4>Conversation privacy</h4><p>Only messages from the current chat are used as context. No memory is shared between groups.</p></div>
      {groupVersion?<><a className="button" href={'/chat?'+new URLSearchParams({room:selectedAgent.room_id!})}><MessageCircle size={16}/>Open chat</a>{own&&<button className="builder-remove" disabled={working} onClick={()=>void action(async()=>{await removeFriend(selectedAgent.room_id!,selectedAgent.id);await load();setView('library');setNotice('Removed from this group. Past messages are preserved.');})}>Remove from this group</button>}</>:own?<><label>Add to a group<select value={targetRoom} onChange={e=>setTargetRoom(e.target.value)}><option value="">Choose a group</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}{r.ai_only?' · private':''}</option>)}</select></label><button className="button" disabled={!targetRoom||working} onClick={()=>void action(async()=>{await addToRoom(selectedAgent.id,targetRoom);await load();setNotice('Added to the chat. The original stays in your library.');})}><Plus size={16}/>Add friend</button><button className="button" disabled={working} onClick={()=>chat([selectedAgent.id])}><MessageCircle size={16}/>Chat one-to-one</button></>:<p>Use this friend as a template to create your own.</p>}
      <div className="builder-preview-about"><h4>Permissions</h4><p>{selectedAgent.allow_template?'Template copying allowed.':'Template copying off.'}</p><p>{selectedAgent.allow_group_edit?'Members can customize group versions.':'Only the creator can customize.'}</p></div>
     </aside>
    </>:<section className="builder-collection builder-empty"><h3>{loading?'Loading profile…':'Friend not available'}</h3>{!loading&&<p>This profile may be private or belong to a group you haven’t joined.</p>}</section>)}
    {view==='editor'&&<>
     <form className="builder-form" onSubmit={editor.save}><fieldset disabled={editor.busy||!user}>
      <section className="builder-section"><div className="builder-section-heading"><span>01</span><div><h3>Identity</h3><p>Start with a name and something they’re great at.</p></div></div>
       <label>Name<input autoFocus required pattern="[A-Za-z][A-Za-z0-9_\-]{1,23}" minLength={2} maxLength={24} value={editor.form.name} onChange={e=>editor.setForm({...editor.form,name:e.target.value})} placeholder="e.g. Nova"/><small>2–24 characters. Start with a letter; use letters, numbers, underscores or hyphens.</small></label>
       <span className="builder-field-label">Choose an avatar</span><div className="studio-avatars" role="group" aria-label="Avatar">{avatars.map(avatar=><button type="button" key={avatar} aria-label={`Avatar ${avatar}`} aria-pressed={editor.form.avatar===avatar} onClick={()=>editor.setForm({...editor.form,avatar})}>{avatar}</button>)}</div>
       <label>Role & interests<input required maxLength={200} value={editor.form.specialty} onChange={e=>editor.setForm({...editor.form,specialty:e.target.value})} placeholder="A creative sidekick for music, games, and weekend plans"/></label>
      </section>
      <section className="builder-section"><div className="builder-section-heading"><span>02</span><div><h3>Behavior</h3><p>Decide what makes your friend feel like themselves.</p></div></div>
       <label>Personality<textarea required maxLength={500} value={editor.form.personality} onChange={e=>editor.setForm({...editor.form,personality:e.target.value})} placeholder="Curious, warm, quick-witted. Keeps things fun and makes everyone feel included."/></label>
       <label>Custom instructions <small>Optional</small><textarea maxLength={1500} value={editor.form.system_prompt} onChange={e=>editor.setForm({...editor.form,system_prompt:e.target.value})} placeholder="Keep replies short. Ask about the group’s interests before suggesting an activity."/></label>
      </section>
      <section className="builder-section"><div className="builder-section-heading"><span>03</span><div><h3>Skills & capabilities</h3><p>Choose up to six skills to guide how your friend helps.</p></div></div>
       <div className="builder-skill-grid">{skills.map(s=><button type="button" key={s.id} aria-pressed={editor.form.skills.includes(s.id)} disabled={!editor.form.skills.includes(s.id)&&editor.form.skills.length>=6} onClick={()=>editor.setForm({...editor.form,skills:editor.form.skills.includes(s.id)?editor.form.skills.filter(id=>id!==s.id):[...editor.form.skills,s.id]})}><span>{s.icon}</span><strong>{s.name}</strong><small>{s.description}</small>{editor.form.skills.includes(s.id)&&<Check size={14}/>}</button>)}</div>
       <div className="builder-capability"><Cpu size={18}/><div><strong>Model</strong><small>Gemini · Automatically routed</small></div><span>Active</span></div>
       <div className="builder-capability"><Globe size={18}/><div><strong>Web search</strong><small>Live search integration</small></div><span>Not connected</span></div>
       <div className="builder-capability"><Code2 size={18}/><div><strong>Web scraping</strong><small>Website extraction</small></div><span>Not connected</span></div>
       <p className="builder-help">Skills work with text shared in chat. No live browsing, scraping, or code execution.</p>
      </section>
      {!editingGroup&&<section className="builder-section"><div className="builder-section-heading"><span>04</span><div><h3>Sharing & permissions</h3><p>Your Studio original is always yours to edit.</p></div></div><label className="builder-toggle"><input type="checkbox" checked={editor.form.allow_template} onChange={e=>editor.setForm({...editor.form,allow_template:e.target.checked})}/><span>Allow template copying<small>Group members can create their own friend from this profile. Chat history is never copied.</small></span></label><label className="builder-toggle"><input type="checkbox" checked={editor.form.allow_group_edit} onChange={e=>editor.setForm({...editor.form,allow_group_edit:e.target.checked})}/><span>Allow group customization<small>Members can change their group’s version. Your original and other groups stay unchanged.</small></span></label></section>}
      {editingGroup&&<p className="studio-notice">Changes apply only to this group’s version.</p>}{editor.error&&<p role="alert" className="error">{editor.error}</p>}
      <footer className="builder-footer"><button className="primary">{editor.busy?'Saving…':editingGroup?'Save group version':editor.editing?'Save changes':'Create friend'}</button></footer>
     </fieldset></form>
     <AgentPreview name={editor.form.name} avatar={editor.form.avatar} specialty={editor.form.specialty} personality={editor.form.personality}/>
    </>}
   </div>
  </section>
 </main>;
}
