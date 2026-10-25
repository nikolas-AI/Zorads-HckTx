"use client";
import { useEffect, useRef } from "react";
import { X, Plus, Pencil, Sparkles, ArrowLeft, Cpu, Search, Brain } from "lucide-react";
import { useAgentEditor } from "@/hooks/use-agent-editor";
import AgentPreview from "./agent-preview";
import type { Agent } from "@/lib/types";
const avatars = ["✦", "☀", "☾", "♫", "✿", "⚡", "♥", "●"];

export default function AgentStudio({ roomId, userId, agents, onClose, onSaved }: {
  roomId: string; userId: string; agents: Agent[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { editing, form, setForm, busy, error, notice, removing, setRemoving, start, save, remove } = useAgentEditor(roomId, onSaved);
  const customAgents = agents.filter(agent => agent.room_id && !agent.archived);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="studio agent-builder" aria-labelledby="studio-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="builder-header"><button className="builder-back" type="button" aria-label="Back to chat" disabled={busy} onClick={onClose}><ArrowLeft size={20}/></button><div><h2 id="studio-title">{editing ? "Edit your AI friend" : "Create an AI friend"}</h2></div><button aria-label="Close AI friend creator" disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <div className="builder-workspace">
      <nav className="builder-library" aria-label="Custom friends">
        <button className={!editing ? "selected" : ""} disabled={busy} onClick={() => start()}><Plus size={18}/>New friend</button>
        <h3>Your creations</h3>
        {customAgents.map(agent => <button key={agent.id} disabled={busy || agent.owner_id !== userId} className={editing === agent.id ? "selected" : ""} onClick={() => start(agent)}><span>{agent.avatar}</span><span>{agent.name}<small>{agent.owner_id === userId ? "Created by you" : "Group member"}</small></span>{agent.owner_id === userId && <Pencil size={14}/>}</button>)}
        {!customAgents.length && <p>Your friends will appear here once you create them.</p>}
        <div className="builder-library-note"><Sparkles size={18}/><p>Give your group a new perspective.</p></div>
      </nav>
      <form className="builder-form" onSubmit={save}><fieldset disabled={busy}>
        <section className="builder-section"><div className="builder-section-heading"><span>01</span><div><h3>Identity</h3><p>Start with a name and something they’re great at.</p></div></div>
          <label>Name<input autoFocus required pattern="[A-Za-z][A-Za-z0-9_\-]{1,23}" minLength={2} maxLength={24} value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Nova"/><small>2–24 characters. Start with a letter; use letters, numbers, underscores or hyphens.</small></label>
          <span className="builder-field-label">Choose an avatar</span><div className="studio-avatars" role="group" aria-label="Avatar">{avatars.map(avatar => <button type="button" key={avatar} aria-label={`Avatar ${avatar}`} aria-pressed={form.avatar === avatar} onClick={() => setForm({...form, avatar})}>{avatar}</button>)}</div>
          <label>Role & interests<input required maxLength={200} value={form.specialty} onChange={e => setForm({...form, specialty:e.target.value})} placeholder="A creative sidekick for music, games, and weekend plans"/></label>
        </section>
        <section className="builder-section"><div className="builder-section-heading"><span>02</span><div><h3>Behavior</h3><p>Decide what makes your friend feel like themselves.</p></div></div>
          <label>Personality<textarea required maxLength={500} value={form.personality} onChange={e => setForm({...form, personality:e.target.value})} placeholder="Curious, warm, quick-witted. Keeps things fun and makes everyone feel included."/></label>
          <label>Custom instructions <small>Optional</small><textarea maxLength={1500} value={form.system_prompt} onChange={e => setForm({...form, system_prompt:e.target.value})} placeholder="Keep replies short. Ask about the group’s interests before suggesting an activity."/></label>
        </section>
        <section className="builder-section"><div className="builder-section-heading"><span>03</span><div><h3>Capabilities</h3><p>What your friend can access.</p></div></div>
          <div className="builder-capability"><Cpu size={18}/><div><strong>Model</strong><small>Gemini · Automatically routed</small></div><span>Active</span></div>
          <div className="builder-capability"><Search size={18}/><div><strong>Web search</strong><small>Live search integration</small></div><span>Not connected</span></div>
          <div className="builder-capability"><Brain size={18}/><div><strong>Persistent memory</strong><small>Approved memory across conversations</small></div><span>Not connected</span></div>
        </section>
        {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status" className="studio-notice">{notice}</p>}
        <footer className="builder-footer"><button className="primary">{busy ? "Saving…" : editing ? "Save changes" : "Create friend"}</button></footer>
        {editing && <div className="studio-remove">{removing ? <><p>Remove this friend? Past messages stay.</p><button type="button" onClick={() => void remove()}>Remove friend</button><button type="button" onClick={() => setRemoving(false)}>Keep friend</button></> : <button type="button" onClick={() => setRemoving(true)}>Remove from group</button>}</div>}
      </fieldset></form>
      <AgentPreview name={form.name} avatar={form.avatar} specialty={form.specialty} personality={form.personality}/>
    </div>
  </dialog>;
}
