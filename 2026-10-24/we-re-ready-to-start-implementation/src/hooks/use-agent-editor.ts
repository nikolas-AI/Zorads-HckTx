"use client";

import { useState, type FormEvent } from "react";
import { saveFriend, removeFriend } from "@/lib/agent-repository";
import type { Agent } from "@/lib/types";

const empty = { name: "", personality: "", specialty: "", avatar: "✦", system_prompt: "" };
export function useAgentEditor(roomId: string, onSaved: () => Promise<void>) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState(false);
  function start(agent?: Agent) {
    setEditing(agent?.id || null);
    setForm(agent ? { name: agent.name, personality: agent.personality, specialty: agent.specialty, avatar: agent.avatar, system_prompt: agent.system_prompt } : empty);
    setError(""); setNotice(""); setRemoving(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await saveFriend(roomId, editing, form);
      const wasEditing = Boolean(editing);
      await onSaved(); start(); setNotice(wasEditing ? "Your friend has been updated." : `${form.name.trim()} is in the group. Say @${form.name.trim()} to start a conversation.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your friend."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !editing) return;
    setBusy(true); setError("");
    try {
      await removeFriend(roomId, editing);
      await onSaved(); start(); setNotice("Friend removed. Past messages are still here.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove your friend."); }
    finally { setBusy(false); }
  }
  return { editing, form, setForm, busy, error, notice, removing, setRemoving, start, save, remove };
}
