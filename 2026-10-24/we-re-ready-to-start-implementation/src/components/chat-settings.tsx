"use client";

import { useEffect, useRef, useState } from "react";
import { readPreferences, savePreference, type PreferenceKey } from "@/lib/chat-preferences";
import { ArrowLeft, X } from "lucide-react";

export default function ChatSettings({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preferences, setPreferences] = useState({ chatLargeText: false, chatCompact: false, chatDark: false });
  const [error, setError] = useState("");

  useEffect(() => {
    setPreferences(readPreferences());
    dialog.current?.showModal();
  }, []);

  function update(key: PreferenceKey, value: boolean) {
    setPreferences(previous => ({ ...previous, [key]: value }));
    setError(savePreference(key, value) ? "" : "Preference applied, but could not be saved on this device.");
  }

  return <dialog className="chat-settings" ref={dialog} onCancel={onClose} aria-labelledby="settings-title">
    <header><button aria-label="Back to profile menu" onClick={() => { dialog.current?.close(); onBack(); }}><ArrowLeft size={20} /></button><h2 id="settings-title">Settings</h2><button aria-label="Close settings" onClick={onClose}><X size={20} /></button></header>
    <h3>Display</h3>
    <label><span>Dark theme<small>Use a black and charcoal appearance.</small></span><input type="checkbox" role="switch" checked={preferences.chatDark} onChange={event => update("chatDark", event.target.checked)} /></label>
    <label><span>Larger message text<small>Make messages easier to read.</small></span><input type="checkbox" checked={preferences.chatLargeText} onChange={event => update("chatLargeText", event.target.checked)} /></label>
    <label><span>Compact conversations<small>Reduce space between messages.</small></span><input type="checkbox" checked={preferences.chatCompact} onChange={event => update("chatCompact", event.target.checked)} /></label>
    <p>Preferences are saved on this device.</p>
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
