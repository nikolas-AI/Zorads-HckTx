"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

export default function CreateAiFriend({ room }: { room: string }) {
  return (
    <details className="ai-friend-menu">
      <summary className="button ai-create-button" aria-label="AI friend options" title="AI friend options"><Bot size={20} /></summary>
      <nav aria-label="AI friend actions">
        <Link href={`/chat/ai/create?${new URLSearchParams({ room })}`}>Create a new AI friend</Link>
      </nav>
    </details>
  );
}
