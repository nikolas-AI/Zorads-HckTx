"use client";

import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { useState, type FormEvent } from "react";
import { validateNickname } from "@/lib/nicknames";
import ShareChat from "@/components/share-chat";
import { ArrowLeft } from "lucide-react";
import { createRoom } from "@/lib/create-room";
import { validateRoomName } from "@/lib/room-names";

export default function CreateChat() {
  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = validateRoomName(name) || validateNickname(nickname);
    setError(validation || "");
    if (validation) return;
    setBusy(true);
    try {
      const displayName = nickname.trim();
      const createdRoom = await createRoom(name, displayName);
      localStorage.setItem("friends-name", displayName);
      setRoom(createdRoom);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create your chat. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <Link className="landing-brand" href="/" aria-label="AImigos home"><BrandLogo /><span>AImigos</span></Link>
      {room ? <ShareChat room={room} name={name.trim()} /> : <section className="create-chat" aria-labelledby="create-title">
        <Link className="create-back" href="/"><ArrowLeft size={16} aria-hidden="true" />Back to welcome</Link>
        <h1 id="create-title">Name your group chat</h1>
        <form onSubmit={submit}>
          <label htmlFor="group-name">Group name</label>
          <input id="group-name" value={name} onChange={event => { setName(event.target.value); setError(""); }} placeholder="Weekend crew" autoFocus required disabled={busy} aria-describedby={error ? "group-error" : undefined} />
          <label htmlFor="nickname">Your nickname</label>
          <input id="nickname" autoComplete="nickname" value={nickname} onChange={event => { setNickname(event.target.value); setError(""); }} placeholder="Alex Smith" required disabled={busy} aria-describedby={error ? "group-error" : undefined} />
          {error && <p className="create-error" id="group-error" role="alert">{error}</p>}
          <button className="landing-action landing-create" disabled={busy || !name.trim() || !nickname.trim()}>{busy ? "Creating..." : "Create group"}</button>
        </form>
      </section>}
    </main>
  );
}
