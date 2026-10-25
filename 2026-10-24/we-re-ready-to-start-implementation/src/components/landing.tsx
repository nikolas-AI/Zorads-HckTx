"use client";

import { invitePath, parseInvite } from "@/lib/invites";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import { useEffect } from "react";
import JoinChat from "@/components/join-chat";

export default function Landing() {
  useEffect(() => {
    // Preserve invitations shared before the chat received its own route.
    const invite = parseInvite(window.location.href);
    if (invite) { window.location.replace(invitePath(invite)); return; }
    if (window.location.hash || new URLSearchParams(window.location.search).has("room")) {
      window.location.replace(`/chat${window.location.search}${window.location.hash}`);
    }
  }, []);


  return (
    <main className="landing" aria-label="Chat">
      <div className="landing-brand" aria-label="friends"><MessageCircle size={22} strokeWidth={2.5} /><span>friends<span className="landing-brand-dot">.</span></span></div>
      <div className="landing-actions">
        <Link className="landing-action landing-create" href="/chat/create"><span className="landing-action-icon"><Plus size={28} strokeWidth={1.6} /></span><span className="landing-action-label">Create a chat</span></Link>
        <JoinChat />
      </div>

    </main>
  );
}
