"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { parseInvite, type Invite } from "@/lib/invites";
import { joinRoom } from "@/lib/join-room";
import { validateNickname } from "@/lib/nicknames";

export default function JoinGroup() {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const invitation = parseInvite(location.href);
    setInvite(invitation);
    if (!invitation) setError("This invite link is incomplete. Ask for a new one.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite || busy) return;
    const validation = validateNickname(nickname);
    setError(validation || "");
    if (validation) return;
    setBusy(true);
    try {
      const room = await joinRoom(invite, nickname);
      localStorage.setItem("friends-name", nickname.trim());
      router.replace(`/chat?${new URLSearchParams({ room })}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not join this chat. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <Link className="landing-brand" href="/" aria-label="friends home"><MessageCircle size={22} /><span>friends<span className="landing-brand-dot">.</span></span></Link>
      <section className="create-chat" aria-labelledby="nickname-title">
        <h1 id="nickname-title">Choose your nickname</h1>
        <form onSubmit={submit}>
          <input aria-label="Nickname" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Alex Smith ✨" autoFocus required disabled={busy} aria-describedby={error ? "nickname-error" : undefined} />
          {error && <p className="create-error" id="nickname-error" role="alert">{error}</p>}
          <button className="landing-action landing-create" disabled={!invite || busy || !nickname.trim()}>{busy ? "Joining…" : "Join chat"}</button>
        </form>
      </section>
    </main>
  );
}
