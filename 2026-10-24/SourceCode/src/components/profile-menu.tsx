"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, Settings, Sparkles } from "lucide-react";
import { restorePreferences } from "@/lib/chat-preferences";
import ChatSettings from "./chat-settings";

export default function ProfileMenu({ name, canCreate, onCreateFriend }: {
  name: string;
  canCreate: boolean;
  onCreateFriend: () => void;
}) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState(false);

  useEffect(restorePreferences, []);

  return <>
    <button className="my-profile profile-trigger" popoverTarget={id} aria-label="Open profile menu">
      <span className="avatar human">{Array.from(name)[0]?.toUpperCase() || "Y"}</span>
      <span className="profile-copy">{name || "You"}<small>Your space to connect</small></span>
      <ChevronUp size={16} />
    </button>
    <div id={id} ref={menu} popover="auto" className="profile-popup" aria-label="Profile options">
      <button disabled={!canCreate} onClick={() => { menu.current?.hidePopover(); onCreateFriend(); }}><Sparkles size={18} />Create an AI friend</button>
      <button onClick={() => { menu.current?.hidePopover(); setSettings(true); }}><Settings size={18} />Settings</button>
    </div>
    {settings && <ChatSettings onClose={() => setSettings(false)} onBack={() => { setSettings(false); menu.current?.showPopover(); }} />}
  </>;
}
