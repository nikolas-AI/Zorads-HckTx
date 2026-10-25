"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { validateNickname } from "@/lib/nicknames";
import ShareChat from "@/components/share-chat";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { createRoom } from "@/lib/create-room";
import { validateRoomName } from "@/lib/room-names";

export default function CreateChat() {
  const [nickname, setNickname] = useState("");
  const [naming, setNaming] = useState(false);
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const validation = naming ? validateNickname(nickname) : validateRoomName(name);
    setError(validation || "");
    if (validation) return;
    if (!naming) { setNaming(true); return; }
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
      <Link className="landing-brand" href="/" aria-label="friends home"><MessageCircle size={22} /><span>friends<span className="landing-brand-dot">.</span></span></Link>
      {room ? <ShareChat room={room} name={name.trim()} /> : <section className="create-chat" aria-labelledby="create-title">
        <Link className="create-back" href="/"><ArrowLeft size={16} />Back</Link>
        <h1 id="create-title">{naming ? "Choose your nickname" : "Name your group chat"}</h1>
        <form onSubmit={submit}>
          <input key={naming ? "nickname" : "group"} id="group-name" aria-label={naming ? "Nickname" : "Group name"} value={naming ? nickname : name} onChange={event => { (naming ? setNickname : setName)(event.target.value); setError(""); }} placeholder={naming ? "Alex Smith ✨" : "Weekend crew 🎉"} autoFocus required disabled={busy} aria-describedby={error ? "group-error" : undefined} aria-invalid={Boolean(error)} />
          {error && <p className="create-error" id="group-error" role="alert">{error}</p>}
          <button className="landing-action landing-create" disabled={busy || !(naming ? nickname : name).trim()}>{busy ? "Creating…" : naming ? "Create chat" : "Continue"}</button>
        </form>
      </section>}
    </main>
  );
}
