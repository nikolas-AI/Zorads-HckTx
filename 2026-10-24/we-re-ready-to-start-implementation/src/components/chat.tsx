"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Plus, Users, Link as LinkIcon, X, MessageCircle, Sparkles, ChevronLeft, Check, RefreshCw } from "lucide-react";
import { browserDb, configured } from "@/lib/supabase";
import type { Agent, AgentId, Member, Message, Room } from "@/lib/types";
const friends = [
  { id: "paul", name: "Paul", specialty: "Everyday life", personality: "A little wit. A lot of good advice.", avatar: "P" },
  { id: "ravi", name: "Ravi", specialty: "Research & perspective", personality: "A fresh perspective on the big questions.", avatar: "R" },
  { id: "kaira", name: "Kaira", specialty: "Ideas & good times", personality: "Your next great plan starts here.", avatar: "K" }
];
let authPromise: ReturnType<ReturnType<typeof browserDb>["auth"]["signInAnonymously"]> | undefined;
async function identity() {
  const db = browserDb();
  const { data } = await db.auth.getSession();
  if (data.session) return data.session.user;
  authPromise ??= db.auth.signInAnonymously();
  const result = await authPromise;
  authPromise = undefined;
  if (result.error) throw new Error("Could not sign in. Check that anonymous sign-in is enabled in Supabase.");
  return result.data.user!;
}
function mergeMessages(previous: Message[], incoming: Message[]) {
  const merged = new Map(previous.map(m => [m.id, m]));
  incoming.forEach(m => merged.set(m.id, m));
  return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export default function Chat() {
  const [userId, setUserId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [invite, setInvite] = useState<{ room: string; token: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [retry, setRetry] = useState<{ id: string; roomId: string; content: string } | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [loading, setLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const currentRoom = useRef(roomId);
  currentRoom.current = roomId;
  const activeRoom = rooms.find(r => r.id === roomId);
  const loadRooms = async () => {
    const { data, error } = await browserDb().from("rooms").select("id,name,created_at").order("created_at", { ascending: false });
    if (error) throw new Error("Could not load rooms. Check the database migration and connection.");
    setRooms(data || []);
    return data || [];
  };
  useEffect(() => {
    setName(localStorage.getItem("friends-name") || "");
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("room") && hash.get("invite")) setInvite({ room: hash.get("room")!, token: hash.get("invite")! });
    if (!configured) return;
    let alive = true;
    void (async () => {
      try {
        const user = await identity();
        if (!alive) return;
        setUserId(user.id);
        const all = await loadRooms();
        const requested = new URLSearchParams(window.location.search).get("room");
        if (!hash.has("invite")) setRoomId(all.find(r => r.id === requested)?.id || all[0]?.id || "");
        const { data, error } = await browserDb().from("agents").select("*");
        if (error) throw new Error("Could not load AI friends. Apply the database migration.");
        if (alive) setAgents(data || []);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not connect."); }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!roomId || !userId) return;
    const db = browserDb(); let alive = true;
    setMessages([]); setMembers([]); setLoading(true); setConnection("Connecting");
    const sync = async () => {
      const [chat, people] = await Promise.all([
        db.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
        db.from("members").select("user_id,display_name").eq("room_id", roomId)
      ]);
      if (!alive) return;
      if (chat.error || people.error) { setError("Could not sync this room. Reconnecting automatically."); setLoading(false); return; }
      setMessages(previous => mergeMessages(previous, chat.data || []));
      setHasOlder((chat.data?.length || 0) === 100);
      setMembers(people.data || []); setLoading(false);
    };
    const channel = db.channel(`room-${roomId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, () => void sync())
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `room_id=eq.${roomId}` }, () => void sync())
      .subscribe(status => { if (!alive) return; setConnection(status === "SUBSCRIBED" ? "Live" : "Reconnecting"); if (status === "SUBSCRIBED") void sync(); });
    void sync();
    const timer = setInterval(() => { setNow(Date.now()); void sync(); }, 15000);
    const onFocus = () => void sync(); window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", onFocus); void db.removeChannel(channel); };
  }, [roomId, userId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.at(-1)?.id, messages.at(-1)?.status]);
  function selectRoom(id: string) { setDraft(""); setRoomId(id); setError(""); history.replaceState(null, "", `?room=${id}`); }
  async function enterRoom(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const db = browserDb();
      const { data, error } = invite ? await db.rpc("join_room", { p_room: invite.room, p_invite: invite.token, p_display_name: name.trim() }) : await db.rpc("create_room", { p_name: roomName.trim(), p_display_name: name.trim() });
      if (error) throw new Error(error.message);
      localStorage.setItem("friends-name", name.trim());
      await loadRooms(); selectRoom(data); setInvite(null); setShowCreate(false); setRoomName("");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open this room."); } finally { setBusy(false); }
  }
  async function copyInvite() {
    try {
      const { data, error } = await browserDb().rpc("room_invite", { p_room: roomId });
      if (error) throw error;
      await navigator.clipboard.writeText(`${location.origin}/#room=${roomId}&invite=${data}`);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch { setError("Couldn't copy the invite. Use HTTPS or localhost and allow clipboard access."); }
  }
  async function send(event?: FormEvent) {
    event?.preventDefault(); if (sending || (!retry && !draft.trim())) return;
    const message = retry || { id: crypto.randomUUID(), roomId, content: draft.trim() };
    setSending(true); setError(""); setRetry(message); setDraft("");
    try {
      const { data: { session } } = await browserDb().auth.getSession();
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` }, body: JSON.stringify(message) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setRetry(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Connection interrupted. Retry your message below."); } finally { setSending(false); composer.current?.focus(); }
  }
  async function older() {
    const first = messages[0]; if (!first) return;
    const { data, error } = await browserDb().from("messages").select("*").eq("room_id", roomId).or(`created_at.lt.${first.created_at},and(created_at.eq.${first.created_at},id.lt.${first.id})`).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (currentRoom.current !== roomId) return;
    if (error) { setError("Couldn't load earlier messages."); return; }
    setMessages(previous => mergeMessages(previous, data || [])); setHasOlder(data?.length === 100);
  }
  function mention(id: string) { setDraft(previous => `${previous}${previous ? " " : ""}@${id[0].toUpperCase()}${id.slice(1)} `); composer.current?.focus(); setShowPeople(false); }
  const visibleFriends = agents.length ? agents : friends;
  return <div className={`app ${activeRoom ? "has-room" : ""}`}>
    <aside className="sidebar">
      <a className="brand" href="/"><span className="brand-icon"><MessageCircle size={23}/></span> friends<span className="brand-dot">.</span></a>
      <div className="sidebar-caption">GOOD COMPANY, ANYWHERE</div>
      <div className="section-heading">YOUR GROUPS <button title="Create a group" aria-label="Create a group" onClick={() => setShowCreate(true)} disabled={!userId}><Plus size={18}/></button></div>
      <nav>{rooms.map(room => <button key={room.id} className={`room-item ${room.id === roomId ? "selected" : ""}`} disabled={sending || Boolean(retry)} onClick={() => selectRoom(room.id)}><span className="room-icon">{room.name.slice(0, 1).toUpperCase()}</span><span>{room.name}<small>You + your people + AI</small></span></button>)}</nav>
      {!rooms.length && <p className="muted sidebar-empty">Your next good conversation starts with a group.</p>}
      <div className="sidebar-bottom"><span className="little-orbit">✳</span><p>More perspectives.<br/><strong>More together.</strong></p><small>AI friends join in when you @mention them.</small></div>
      <div className="my-profile"><span className="avatar human">{name.slice(0,1).toUpperCase() || "Y"}</span><div>{name || "You"}<small>Your space to connect</small></div></div>
    </aside>
    <main className="main">
      {activeRoom ? <>
        <header className="chat-header"><button className="mobile-back" aria-label="Back to groups" disabled={sending || Boolean(retry)} onClick={() => setRoomId("")}><ChevronLeft/></button><div className="room-icon header-icon">{activeRoom.name.slice(0,1).toUpperCase()}</div><div className="header-title"><h1>{activeRoom.name}</h1><p><span className={`status-dot ${connection === "Live" ? "live" : ""}`}/>{connection} <span className="separator">·</span> {members.length} {members.length === 1 ? "person" : "people"} + 3 AI friends</p></div><button className="button invite-button" onClick={copyInvite}>{copied ? <Check size={16}/> : <LinkIcon size={16}/>}<span>{copied ? "Copied!" : "Invite friends"}</span></button><button className="people-toggle" aria-label="Show participants" onClick={() => setShowPeople(true)}><Users size={20}/></button></header>
        <div className="conversation" role="log" aria-label="Group messages" aria-live="polite">
          <div className="conversation-intro"><span>THE START OF SOMETHING GOOD</span><h2>Everybody’s here.<br/>Make yourselves at home.</h2><p>Catch up with your people. Bring in a fresh perspective.</p></div>
          {hasOlder && <button className="older button" onClick={older}>Load earlier messages</button>}
          {loading && <p className="center muted">Loading your conversation…</p>}
          {!loading && !messages.length && <div className="starters">{["@Paul what should we cook together?", "@Ravi help us compare camping and a cabin", "@Kaira plan a fun Saturday with friends"].map(text => <button key={text} onClick={() => {setDraft(text); composer.current?.focus();}}>{text}<span>↗</span></button>)}</div>}
          {messages.map(message => {
            const own = message.user_id === userId;
            const waiting = message.status === "pending" || message.status === "generating";
            const stale = waiting && (now || Date.now()) - Date.parse(message.created_at) > 90000;
            return <article className={`message ${own ? "own" : ""}`} key={message.id}><span className={`avatar ${message.agent_id || "human"}`}>{message.sender_name.slice(0,1).toUpperCase()}</span><div className="message-main"><div className="message-meta"><strong>{own ? "You" : message.sender_name}</strong>{message.agent_id && <span className="ai-badge">AI</span>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><div className={`bubble ${message.agent_id ? "ai-bubble" : ""} ${message.status === "failed" || stale ? "failed" : ""}`}>{stale ? "This reply was interrupted. Send a new mention to try again." : waiting ? <span className="typing">Thinking <i/><i/><i/></span> : message.content}</div></div></article>;
          })}<div ref={bottom}/>
        </div>
        <div className="composer-area">{error && <div role="alert" className="error">{error}<button aria-label="Dismiss error" onClick={() => setError("")}><X size={15}/></button></div>}
          {retry && !sending && <div className="retry"><span>Not confirmed: {retry.content.slice(0, 80)}</span><button onClick={() => void send()}><RefreshCw size={14}/>Retry</button><button onClick={() => {setDraft(retry.content);setRetry(null);}}>Edit as new</button></div>}
          <form className="composer" onSubmit={send}><textarea ref={composer} aria-label="Message" placeholder="Say something… @mention an AI friend to bring them in" maxLength={4000} value={draft} disabled={Boolean(retry)} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/><button className="send-button" aria-label="Send message" disabled={sending || !draft.trim() || Boolean(retry)}><ArrowUp size={22}/></button></form><div className="composer-hint"><span>Good conversations start with you.</span><span>↵ send <span className="separator">·</span> shift + ↵ new line</span></div>
        </div>
      </> : <div className="welcome"><div className="welcome-label"><Sparkles size={15}/> YOUR PEOPLE. A FEW NEW PERSPECTIVES.</div><h1>Life’s better<br/>in good company<span>.</span></h1><p>A place for your friends, your plans, and three AI friends who bring something different to the conversation.</p><div className="welcome-friends">{friends.map(friend => <div key={friend.id}><span className={`avatar ${friend.id}`}>{friend.avatar}</span><strong>{friend.name}</strong><small>{friend.specialty}</small></div>)}</div>{!configured ? <div className="setup"><strong>Let’s connect your space.</strong><p>Add the Supabase settings in <code>.env.local</code>, enable anonymous sign-in, and apply the database migration. Add your Gemini key for real AI replies.</p><small>No demo messages or simulated AI responses.</small></div> : <button className="primary" disabled={!userId} onClick={() => setShowCreate(true)}><Plus size={18}/>{userId ? "Start a group" : "Connecting…"}</button>}{error && <div className="error" role="alert">{error}</div>}<div className="welcome-note">Human connection, with a little help from AI.</div></div>}
    </main>
    {activeRoom && <aside className={`people-panel ${showPeople ? "open" : ""}`}><div className="panel-heading"><h2>The company</h2><button className="close-people" aria-label="Close participants" onClick={() => setShowPeople(false)}><X size={20}/></button><span>{members.length + 3}</span></div><p className="eyebrow">YOUR AI FRIENDS</p>{visibleFriends.map(friend => <button className="friend-card" key={friend.id} onClick={() => mention(friend.id)}><div className="friend-top"><span className={`avatar ${friend.id}`}>{friend.avatar}</span><div><strong>{friend.name} <span className="ai-badge">AI</span></strong><small>{friend.specialty}</small></div><span className="mention-icon">@</span></div><p>{friend.personality}</p></button>)}<div className="quiet-note"><Sparkles size={16}/><span>Here when you need them.<br/>Mention a friend to invite them in.</span></div><p className="eyebrow people-label">YOUR PEOPLE · {members.length}</p>{members.map(member => <div className="person" key={member.user_id}><span className="avatar human">{member.display_name.slice(0,1).toUpperCase()}</span><span>{member.display_name}{member.user_id === userId && <small> (you)</small>}</span></div>)}<div className="panel-footer">A shared space for real connection.</div></aside>}
    {(showCreate || invite) && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="room-dialog"><button className="modal-close" aria-label="Close" onClick={() => {setShowCreate(false);setInvite(null);history.replaceState(null,"",location.pathname);}}><X size={20}/></button><span className="brand-icon"><Users size={24}/></span><h2 id="room-dialog">{invite ? "You’re invited." : "Bring your people together."}</h2><p>{invite ? "Pick a name and make yourself at home." : "A group for your friends, with a little extra perspective."}</p><form onSubmit={enterRoom}><label>Your display name<input autoFocus required maxLength={32} value={name} onChange={event => setName(event.target.value)} placeholder="What should we call you?"/></label>{!invite && <label>Group name<input required maxLength={60} value={roomName} onChange={event => setRoomName(event.target.value)} placeholder="The weekend crew"/></label>}{error && <div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy || !userId || !name.trim() || (!invite && !roomName.trim())}>{busy ? "Opening your group…" : invite ? "Join the conversation" : "Create group"}</button></form><small>Paul, Ravi, and Kaira are included. AI only joins in when mentioned.</small></section></div>}
  </div>;
}

