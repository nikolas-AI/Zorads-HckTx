"use client";

import { invitePath, parseInvite } from "@/lib/invites";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { browserDb, configured } from "@/lib/supabase";
import { withTimeout } from "@/lib/with-timeout";
import type { Session } from "@supabase/supabase-js";
import type { Room } from "@/lib/types";
import JoinChat from "@/components/join-chat";

export default function Landing({ embedded = false }: { embedded?: boolean }) {
  const Container = embedded ? "section" : "main";
  const [lookup, setLookup] = useState<"loading" | "ready" | "error" | "no-session" | "empty" | "unconfigured">("loading");
  const [stage, setStage] = useState("");
  const [previous, setPrevious] = useState<Room | null>(null);
  useEffect(() => {
    // Preserve invitations shared before the chat received its own route.
    const invite = parseInvite(window.location.href);
    if (invite) { window.location.replace(invitePath(invite)); return; }
    if (window.location.pathname === "/" && (window.location.hash || new URLSearchParams(window.location.search).has("room"))) {
      window.location.replace(`/chat${window.location.search}${window.location.hash}`);
    }
    if (!configured) { setLookup("unconfigured"); return; }
    const db = browserDb();
    let alive = true;
    let revision = 0;
    let currentUser: string | null | undefined;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    let authEventReceived = false;
    setLookup("loading");
    setStage("Restoring your saved session...");
    async function loadForSession(session: Session | null, force = false) {
      if (!alive) return;
      const user = session?.user.id || null;
      // Token refresh and duplicate SIGNED_IN events must not cancel a running lookup.
      if (!force && user === currentUser) return;
      if (currentUser !== user) setPrevious(null);
      currentUser = user;
      const request = ++revision;
      if (!session) { setPrevious(null); setLookup("no-session"); return; }
      setLookup("loading");
      setStage("Loading your previous groups...");
      try {
        const { data, error } = await withTimeout(db.from("rooms").select("id,name,created_at,ai_only").order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(15000)), 16000);
        if (!alive || request !== revision) return;
        if (error) throw error;
        let last = "";
        try { last = localStorage.getItem("friends-last-room") || ""; } catch {}
        setPrevious(data?.find(room => room.id === last) || data?.[0] || null);
        setLookup(data?.length ? "ready" : "empty");
      } catch {
        if (alive && request === revision) setLookup("error");
      }
    }
    // Use the supplied session directly, without another auth lookup.
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      clearTimeout(scheduled);
      scheduled = setTimeout(() => { void loadForSession(session); }, 0);
    });
    void withTimeout(db.auth.getSession(), 10000).then(({ data, error }) => {
      if (!alive || authEventReceived) return;
      if (error) { setLookup("error"); return; }
      void loadForSession(data.session);
    }).catch(() => { if (alive && !authEventReceived) setLookup("error"); });
    const refresh = () => {
      void withTimeout(db.auth.getSession(), 10000).then(({ data, error }) => {
        if (!alive) return;
        if (error) { setLookup("error"); return; }
        void loadForSession(data.session, true);
      }).catch(() => { if (alive) setLookup("error"); });
    };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      alive = false;
      ++revision;
      clearTimeout(scheduled);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);


  return (
    <Container className="landing" aria-label="Chat">
      <div className="landing-brand" aria-label="AImigos"><BrandLogo /><span>AImigos</span></div>
      <section className="landing-welcome">
      <p className="landing-eyebrow">A LITTLE SPACE FOR YOUR PEOPLE</p>
      <h1>Good company starts here.</h1>
      <p>Create a group, bring your people, and make it your own.</p>
      <div className="landing-actions">
        <Link className="landing-action landing-create" href="/chat/create"><span className="landing-action-icon"><Plus size={28} strokeWidth={1.6} /></span><span className="landing-action-label">Create a group</span></Link>
        <JoinChat />
      </div>
      {!previous && <form action="/" method="get">
        <button type="submit" name="loadChats" value="1" className="load-previous-chats">Load your previous chats</button>
      </form>}
      {lookup === "loading" && stage && <p role="status" className="resume-status">{stage}</p>}
      {lookup === "error" && <div role="alert" className="resume-status">Could not load your previous groups.</div>}
      {lookup === "no-session" && <div role="status" className="resume-status">No saved sign-in session was found in this browser.</div>}
      {lookup === "empty" && <div role="status" className="resume-status">Your session is restored, but no previous groups were found.</div>}
      {lookup === "unconfigured" && <p role="status" className="resume-status">The app is not connected to Supabase.</p>}
      {previous && <Link className="landing-resume" href={`/chat?room=${previous.id}`}><span>Continue previous group</span><strong>{previous.name} &rarr;</strong></Link>}
      </section>
    </Container>
  );
}
