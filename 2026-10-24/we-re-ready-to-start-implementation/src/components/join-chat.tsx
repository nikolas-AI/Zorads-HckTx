import Link from "next/link";
import { Users } from "lucide-react";

export default function JoinChat() {
  return <Link className="landing-action landing-join" href="/chat/join"><span className="landing-action-icon"><Users size={28} strokeWidth={1.6} /></span><span className="landing-action-label">Join a group</span></Link>;
}
