"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateNickname } from "@/lib/nicknames";
import { identity } from "@/lib/identity";
import { browserDb, configured } from "@/lib/supabase";
import { roomInviteLink } from "@/lib/room-invite";
import { friends } from "@/lib/friends";
import { mergeMessages } from "@/lib/messages";
import { invitePath, parseInvite, type Invite } from "@/lib/invites";
import type { Agent, Member, Message, Room } from "@/lib/types";

export function useChat() {
  const [userId, setUserId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);
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
    setShowCreate(new URLSearchParams(window.location.search).get("create") === "1");
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const invitation = parseInvite(window.location.href);
    if (invitation) { window.location.replace(invitePath(invitation)); return; }
    if (!configured) return;
    let alive = true;
    void (async () => {
      try {
        const user = await identity();
        if (!alive) return;
        setUserId(user.id);
        const all = await loadRooms();
        const requested = new URLSearchParams(window.location.search).get("room");
        if (!alive) return;
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
    event.preventDefault();
    const validation = validateNickname(name);
    if (validation) { setError(validation); return; }
    setBusy(true); setError("");
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
      const link = await roomInviteLink(roomId, location.origin);
      await navigator.clipboard.writeText(link);
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
  return { userId, rooms, roomId, setRoomId, members, messages, name, setName, roomName, setRoomName, invite, setInvite, showCreate, setShowCreate, showPeople, setShowPeople, draft, setDraft, error, setError, busy, sending, retry, setRetry, connection, loading, hasOlder, copied, now, bottom, composer, activeRoom, selectRoom, enterRoom, copyInvite, send, older, mention, visibleFriends };
}
