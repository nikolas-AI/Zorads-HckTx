"use client";

import { useRef, useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { invitePath, parseInvite } from "@/lib/invites";

export default function JoinChat() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");

  function joinChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("invite") || "").trim();
    const invite = parseInvite(value);
    if (invite) window.location.assign(invitePath(invite));
    else setError("Enter a valid chat invite link.");
  }

  return (
    <>
        <button className="landing-action landing-join" onClick={() => { setError(""); dialog.current?.showModal(); }}><span className="landing-action-icon"><Users size={28} strokeWidth={1.6} /></span><span className="landing-action-label">Join a chat</span></button>
      <dialog className="join-dialog" ref={dialog} aria-labelledby="join-title">
        <button className="join-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
        <form onSubmit={joinChat}>
          <h1 id="join-title">Join a chat</h1>
          <label htmlFor="invite-link">Invite link</label>
          <input id="invite-link" name="invite" type="url" placeholder="Paste your invite link" required autoFocus aria-describedby={error ? "join-error" : undefined} />
          {error && <p id="join-error" role="alert">{error}</p>}
          <button className="landing-action landing-create" type="submit">Join a chat</button>
        </form>
      </dialog>
    </>
  );
}
