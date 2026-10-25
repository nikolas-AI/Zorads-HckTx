"use client";

import BrandLogo from "@/components/brand-logo";
import { useState } from "react";
import "./chat.css";
import ProfileMenu from "@/components/profile-menu";

import ParticipantsDropdown from "@/components/participants-dropdown";
import ActivityPanel from "@/components/activity-panel";
import { Activity, ArrowUp, Plus, Users, Link as LinkIcon, X, ChevronLeft, Check, RefreshCw, LogOut } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import Landing from "@/components/landing";

export default function Chat() {

  const [leaving, setLeaving] = useState<{ id: string; name: string } | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const { userId, rooms, roomId, setRoomId, members, messages, name, setName, roomName, setRoomName, invite, setInvite, showCreate, setShowCreate, draft, setDraft, error, setError, busy, sending, retry, setRetry, connection, loading, hasOlder, copied, now, bottom, composer, activeRoom, selectRoom, leaveRoom, enterRoom, copyInvite, send, older, mention, visibleFriends } = useChat();
  return <div className={`app chat-workspace ${activeRoom ? "has-room" : ""}`}>
    <aside className="sidebar">
      <a className="brand" href="/"><BrandLogo /> friends<span className="brand-dot">.</span></a>
      <a className="chat-new" href="/chat/create"><Plus size={18}/>New group chat</a>
      <div className="section-heading">Your groups</div>
      <nav>{rooms.map(room => <div className="room-row" key={room.id}><button className={`room-item ${room.id === roomId ? "selected" : ""}`} disabled={sending || Boolean(retry)} onClick={() => selectRoom(room.id)}><span className="room-icon">{room.name.slice(0, 1).toUpperCase()}</span><span>{room.name}<small>{room.ai_only ? "Private · You + AI" : "Your group"}</small></span></button><button className="leave-group" aria-label={`Leave ${room.name}`} title="Leave group" disabled={busy || sending || Boolean(retry)} onClick={() => setLeaving({id:room.id,name:room.name})}><LogOut size={16}/></button></div>)}</nav>
      {!rooms.length && <p className="muted sidebar-empty">Your next good conversation starts with a group.</p>}

      <ProfileMenu name={name} canCreate={true} onCreateFriend={() => location.assign("/chat/ai/create")} />
    </aside>
    <main className="main">
      {activeRoom ? <>
        <header className="chat-header"><button className="mobile-back" aria-label="Back to groups" disabled={sending || Boolean(retry)} onClick={() => setRoomId("")}><ChevronLeft/></button><div className="room-icon header-icon">{activeRoom.name.slice(0,1).toUpperCase()}</div><div className="header-title"><h1>{activeRoom.name}</h1><p><span className={`status-dot ${connection === "Live" ? "live" : ""}`}/>{connection} <span className="separator">·</span> {members.length} {members.length === 1 ? "person" : "people"} + {visibleFriends.length} AI friends</p></div><div className="chat-header-actions" role="group" aria-label="Group actions">{!activeRoom.ai_only && <button className="button invite-button" onClick={copyInvite}>{copied ? <Check size={16}/> : <LinkIcon size={16}/>}<span>{copied ? "Copied!" : "Invite friends"}</span></button>}<a className="activity-toggle add-companion" aria-label="Add AI companion" title="Add AI companion" href={"/chat/ai/create?"+new URLSearchParams({room:roomId})}><Plus size={18}/><span>Add AI companion</span></a><button className="activity-toggle" aria-label="Show AI activity" title="AI activity" onClick={() => setShowActivity(true)}><Activity size={18}/></button><ParticipantsDropdown key={roomId} friends={visibleFriends} members={members} userId={userId} onMention={mention} onProfile={id => location.assign("/chat/ai/create?"+new URLSearchParams({room:roomId,friend:id}))} /></div></header>
        <div className="conversation" role="log" aria-label="Group messages" aria-live="polite">
          {!messages.length && <div className="conversation-intro"><span>YOUR SPACE, TOGETHER</span><h2>What’s happening today?</h2><p>Say hello to your group, or bring an AI friend into the conversation.</p></div>}
          {hasOlder && <button className="older button" onClick={older}>Load earlier messages</button>}
          {loading && <p className="center muted">Loading your conversation…</p>}
          {!loading && !messages.length && <div className="starters">{visibleFriends.slice(0,3).map(friend => `@${friend.name} what could we explore together?`).map(text => <button key={text} onClick={() => {setDraft(text); composer.current?.focus();}}>{text}<span>↗</span></button>)}</div>}
          {messages.map(message => {
            if (message.event_type) return <div className="chat-notice" key={message.id}><span>{message.content}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>;
            const own = message.user_id === userId;
            const waiting = message.status === "pending" || message.status === "generating";
            const stale = waiting && (now || Date.now()) - Date.parse(message.created_at) > 90000;
            return <article className={`message ${own ? "own" : ""}`} key={message.id}><span className={`avatar ${message.agent_id?.startsWith("custom-") ? "custom" : message.agent_id || "human"}`}>{visibleFriends.find(friend => friend.id === message.agent_id)?.avatar || message.sender_name.slice(0,1).toUpperCase()}</span><div className="message-main"><div className="message-meta"><strong>{message.agent_id ? <a href={"/chat/ai/create?"+new URLSearchParams({room:roomId,friend:message.agent_id})}>{message.sender_name}</a> : own ? "You" : message.sender_name}</strong>{message.agent_id && <span className="ai-badge">AI</span>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><div className={`bubble ${message.agent_id ? "ai-bubble" : ""} ${message.status === "failed" || stale ? "failed" : ""}`}>{stale ? "This reply was interrupted. Send a new mention to try again." : waiting ? <span className="typing">Thinking <i/><i/><i/></span> : message.content}</div></div></article>;
          })}<div ref={bottom}/>
        </div>
        <div className="composer-area">{error && <div role="alert" className="error">{error}<button aria-label="Dismiss error" onClick={() => setError("")}><X size={15}/></button></div>}
          {retry && !sending && <div className="retry"><span>Not confirmed: {retry.content.slice(0, 80)}</span><button onClick={() => void send()}><RefreshCw size={14}/>Retry</button><button onClick={() => {setDraft(retry.content);setRetry(null);}}>Edit as new</button></div>}
          <form className="composer" onSubmit={send}><textarea ref={composer} aria-label="Message" placeholder={activeRoom.ai_only && visibleFriends.length === 1 ? `Message ${visibleFriends[0].name}…` : "Say something… @mention an AI friend to bring them in"} maxLength={4000} value={draft} disabled={Boolean(retry)} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}/><button className="send-button" aria-label="Send message" disabled={sending || !draft.trim() || Boolean(retry)}><ArrowUp size={22}/></button></form>
        </div>
      </> : <><Landing embedded />{error && <div className="error" role="alert">{error}</div>}</>}
    </main>

    {leaving && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="leave-title"><h2 id="leave-title">Leave {leaving.name}?</h2><p>This removes the group from your list. Its messages stay for other members. You will need an invite to rejoin a group; private AI chats cannot be rejoined by invite.</p><div className="leave-actions"><button className="button" disabled={busy} onClick={() => setLeaving(null)}>Cancel</button><button className="primary" disabled={busy} onClick={async () => { await leaveRoom(leaving.id); setLeaving(null); }}>{busy ? "Leaving..." : "Leave group"}</button></div></section></div>}
    {activeRoom && showActivity && <ActivityPanel key={roomId} roomId={roomId} onClose={() => setShowActivity(false)}/>}
    {(showCreate || invite) && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="room-dialog"><button className="modal-close" aria-label="Close" onClick={() => {setShowCreate(false);setInvite(null);history.replaceState(null,"",location.pathname);}}><X size={20}/></button><span className="brand-icon"><Users size={24}/></span><h2 id="room-dialog">{invite ? "You’re invited." : "Bring your people together."}</h2><p>{invite ? "Choose your nickname to join." : "A group for your friends, with a little extra perspective."}</p><form onSubmit={enterRoom}><label>Your nickname<input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="What should we call you?"/></label>{!invite && <label>Group name<input required maxLength={60} value={roomName} onChange={event => setRoomName(event.target.value)} placeholder="The weekend crew"/></label>}{error && <div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy || !userId || !name.trim() || (!invite && !roomName.trim())}>{busy ? "Opening your group…" : invite ? "Join the conversation" : "Create group"}</button></form><small>Zorad is included and only replies to @Zorad. Add more companions whenever you like.</small></section></div>}
  </div>;
}
