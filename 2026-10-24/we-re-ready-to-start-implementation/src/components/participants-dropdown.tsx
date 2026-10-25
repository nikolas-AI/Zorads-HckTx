"use client";

import { useId, useRef } from "react";
import { Bot, Users, X } from "lucide-react";
import type { Agent, Member } from "@/lib/types";

type Friend = Pick<Agent, "id" | "name" | "avatar" | "specialty">;
type Props = {
  friends: Friend[];
  members: Member[];
  userId: string;
  onMention: (name: string) => void;
};

// Owns participant presentation and dismissal; room data stays in useChat.
export default function ParticipantsDropdown({ friends, members, userId, onMention }: Props) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);

  return <>
    <button className="participants-trigger" popoverTarget={id} aria-label="Show participants" title="Participants"><Users size={20} /></button>
    <div id={id} ref={popup} popover="auto" className="participants-dropdown" aria-label="Group participants">
      <header><h2>Participants</h2><button aria-label="Close participants" popoverTarget={id} popoverTargetAction="hide"><X size={18} /></button></header>
      <section aria-labelledby={`${id}-ai`}>
        <h3 id={`${id}-ai`}><Bot size={16} />YOUR AI FRIENDS · {friends.length}</h3>
        <ul>
          {friends.map(friend => <li key={friend.id}><button className="participant-row" onClick={() => { onMention(friend.name); popup.current?.hidePopover(); }}>
            <span className="participant-avatar participant-ai">{friend.avatar}</span>
            <span className="participant-name">{friend.name}<small>{friend.specialty}</small></span>
            <span className="participant-badge">AI</span>
          </button></li>)}
        </ul>
        {!friends.length && <p className="participants-empty">No AI friends in this group yet.</p>}
      </section>
      <section aria-labelledby={`${id}-humans`}>
        <h3 id={`${id}-humans`}><Users size={16} />YOUR PEOPLE · {members.length}</h3>
        <ul>
          {members.map(member => <li className="participant-row" key={member.user_id}>
            <span className="participant-avatar">{Array.from(member.display_name)[0]?.toUpperCase()}</span>
            <span className="participant-name">{member.display_name}{member.user_id === userId && <small>You</small>}</span>
          </li>)}
        </ul>
        {!members.length && <p className="participants-empty">No people to show yet.</p>}
      </section>
    </div>
  </>;
}
