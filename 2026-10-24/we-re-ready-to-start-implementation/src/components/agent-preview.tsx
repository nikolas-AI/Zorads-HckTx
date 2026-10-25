import { Bot, MessageCircle } from "lucide-react";

type Props = { name: string; avatar: string; specialty: string; personality: string };

export default function AgentPreview({ name, avatar, specialty, personality }: Props) {
  return <aside className="builder-preview" aria-label="Agent preview">
    <span className="builder-eyebrow">LIVE PREVIEW</span>
    <div className="builder-preview-avatar">{avatar}</div>
    <h3>{name || "Your AI friend"}</h3>
    <p>{specialty || "A little personality. A fresh perspective."}</p>
    <span className="builder-ai-label"><Bot size={14} />AI friend</span>
    <div className="builder-preview-about"><h4>Personality</h4><p>{personality || "Describe how your friend should think, speak, and help."}</p></div>
    <div className="builder-preview-note"><MessageCircle size={18} /><p>Create your friend, then add them to groups or start a private chat. Each conversation stays separate.</p></div>
    <small>Profile preview · No test message is being generated.</small>
  </aside>;
}
