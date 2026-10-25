"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Plus, Pencil, Sparkles } from "lucide-react";
import { browserDb } from "@/lib/supabase";
import type { Agent } from "@/lib/types";
const empty = { name: "", personality: "", specialty: "", avatar: "✦", system_prompt: "" };
const avatars = ["✦", "☀", "☾", "♫", "✿", "⚡", "♥", "●"];
export default function AgentStudio({ roomId, userId, agents, onClose, onSaved }: {
  roomId: string; userId: string; agents: Agent[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(false);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  function start(agent?: Agent) {
    setEditing(agent?.id || null);
    setForm(agent ? { name: agent.name, personality: agent.personality, specialty: agent.specialty, avatar: agent.avatar, system_prompt: agent.system_prompt } : empty);
    setError(""); setNotice(""); setRemoving(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error } = await browserDb().rpc("save_friend", { p_room: roomId, p_id: editing, p_name: form.name.trim(), p_personality: form.personality.trim(), p_interests: form.specialty.trim(), p_avatar: form.avatar, p_instructions: form.system_prompt.trim() });
      if (error) throw new Error(error.code === "PGRST202" ? "Apply the Agent Studio database migration to create friends." : error.message);
      const wasEditing = Boolean(editing);
      await onSaved(); start(); setNotice(wasEditing ? "Your friend has been updated." : `${form.name.trim()} is in the group. Say @${form.name.trim()} to start a conversation.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your friend."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !editing) return;
    setBusy(true); setError("");
    try {
      const { error } = await browserDb().rpc("remove_friend", { p_room: roomId, p_id: editing });
      if (error) throw new Error(error.message);
      await onSaved(); start(); setNotice("Friend removed. Past messages are still here.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove your friend."); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="studio" aria-labelledby="studio-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><span className="eyebrow">MADE FOR YOUR COMPANY</span><h2 id="studio-title"><Sparkles size={22}/>Agent Studio</h2></div><button aria-label="Close Agent Studio" disabled={busy} onClick={onClose}><X/></button></header>
    <p className="studio-intro">A new perspective, with a personality you choose. Create a friend for this group.</p>
    <div className="studio-layout"><nav aria-label="Custom friends"><button className={!editing ? "selected" : ""} disabled={busy} onClick={() => start()}><Plus size={17}/>Create a friend</button>
      {agents.filter(a => a.room_id && !a.archived).map(agent => <button key={agent.id} disabled={busy || agent.owner_id !== userId} className={editing === agent.id ? "selected" : ""} onClick={() => start(agent)}><span>{agent.avatar}</span><span>{agent.name}<small>{agent.owner_id === userId ? "Created by you" : "Created by a group member"}</small></span>{agent.owner_id === userId && <Pencil size={14}/>}</button>)}
      <p>Friends belong to this group. Everyone can chat with them; their creator can edit them.</p>
    </nav><form onSubmit={save}><fieldset disabled={busy}>
      <div className="studio-preview"><span className="avatar custom">{form.avatar}</span><div><strong>{form.name || "Your new friend"} <span className="ai-badge">AI</span></strong><small>{form.specialty || "What are they into?"}</small></div></div>
      <label>Name<input autoFocus required pattern="[A-Za-z][A-Za-z0-9_\-]{1,23}" minLength={2} maxLength={24} value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Nova"/><small>2–24 characters. Letters, numbers, underscores or hyphens; no spaces.</small></label>
      <div className="studio-avatars" role="group" aria-label="Avatar">{avatars.map(avatar => <button type="button" key={avatar} aria-label={`Avatar ${avatar}`} aria-pressed={form.avatar === avatar} onClick={() => setForm({...form, avatar})}>{avatar}</button>)}</div>
      <label>Personality<textarea required maxLength={500} value={form.personality} onChange={e => setForm({...form, personality:e.target.value})} placeholder="Warm, curious, a little sarcastic. Encouraging without sugar-coating."/></label>
      <label>Interests & specialty<input required maxLength={200} value={form.specialty} onChange={e => setForm({...form, specialty:e.target.value})} placeholder="Indie music, weekend adventures, cooking"/></label>
      <label>Extra instructions <small>optional</small><textarea maxLength={1500} value={form.system_prompt} onChange={e => setForm({...form, system_prompt:e.target.value})} placeholder="Keep suggestions affordable. Ask about our tastes before making a plan."/></label>
      {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="studio-notice">{notice}</p>}
      <button className="primary">{busy ? "Saving…" : editing ? "Save changes" : "Create & add to group"}</button>
      {editing && <div className="studio-remove">{removing ? <><p>Remove this friend from the group? Past messages will stay.</p><button type="button" onClick={() => void remove()}>Remove friend</button><button type="button" onClick={() => setRemoving(false)}>Keep friend</button></> : <button type="button" onClick={() => setRemoving(true)}>Remove from group</button>}</div>}
    </fieldset></form></div>
  </dialog>;
}
