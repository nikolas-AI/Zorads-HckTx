"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseInvite, type Invite } from "@/lib/invites";
import { joinRoom } from "@/lib/join-room";
import { validateNickname } from "@/lib/nicknames";

export default function JoinGroup() {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const invitation = parseInvite(location.href);
    setInvite(invitation);
    if (!invitation && location.hash) setError("This invite link is incomplete. Paste a complete invite link below.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!invite) {
      const parsed = parseInvite(inviteLink.trim());
      if (!parsed) { setError("Enter a complete group invite link, including the part after #."); return; }
      setInvite(parsed); setError(""); return;
    }
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
      <Link className="landing-brand" href="/" aria-label="friends home"><BrandLogo /><span>friends<span className="landing-brand-dot">.</span></span></Link>
      <section className="create-chat" aria-labelledby="nickname-title">
        <Link className="create-back" href="/"><ArrowLeft size={16} aria-hidden="true" />Back to welcome</Link>
        <h1 id="nickname-title">{invite ? "Choose your nickname" : "Join a group"}</h1>
        {!invite && <p>Paste the invite link shared by someone in the group.</p>}
        <form onSubmit={submit}>
          {invite ? <input key="nickname" aria-label="Nickname" value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Alex Smith ✨" autoFocus required disabled={busy} aria-describedby={error ? "nickname-error" : undefined} /> : <input key="invite" aria-label="Invite link" type="url" value={inviteLink} onChange={event => { setInviteLink(event.target.value); setError(""); }} placeholder="Paste your group invite link" autoFocus required aria-describedby={error ? "nickname-error" : undefined} />}
          {error && <p className="create-error" id="nickname-error" role="alert">{error}</p>}
          <button className="landing-action landing-create" disabled={busy || !(invite ? nickname : inviteLink).trim()}>{busy ? "Joining…" : invite ? "Join group" : "Continue"}</button>
        </form>
      </section>
    </main>
  );
}
