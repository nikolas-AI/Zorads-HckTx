"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { roomInviteLink } from "@/lib/room-invite";

export default function ShareChat({ room, name }: { room: string; name: string }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    void roomInviteLink(room, location.origin).then(
      value => { if (active) setLink(value); },
      error => { if (active) setError(error.message); },
    );
    return () => { active = false; };
  }, [room, attempt]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
    } catch {
      setError("Could not copy. Select the link below and copy it manually.");
    }
  }

  return (
    <section className="create-chat share-chat" aria-labelledby="share-title">
      <h1 id="share-title">Invite your people</h1>
      <p className="share-room-name">{name}</p>
      {link ? <>
        <div className="share-qr"><QRCodeSVG value={link} size={208} marginSize={4} level="M" title={`Scan to join ${name}`} /></div>
        <p>Scan the QR code or share the link to join.</p>
        <label className="share-label" htmlFor="share-link">Invite link</label>
        <input id="share-link" value={link} readOnly onFocus={event => event.currentTarget.select()} />
        <button type="button" className="landing-action share-copy" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
        <span className="share-status" role="status">{copied ? "Invite link copied." : ""}</span>
      </> : !error && <p role="status">Preparing your invite…</p>}
      {error && <><p className="create-error" role="alert">{error}</p>{!link && <button type="button" className="landing-action share-copy" onClick={() => setAttempt(value => value + 1)}>Try again</button>}</>}
      <Link className="landing-action landing-create" href={`/chat?${new URLSearchParams({ room })}`}>Enter chat</Link>
    </section>
  );
}
