import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CreateAiFriendPage({ searchParams }: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  const back = room ? `/chat?${new URLSearchParams({ room })}` : "/chat";

  return (
    <main className="landing">
      <section className="create-chat" aria-labelledby="ai-create-title">
        <Link className="create-back" href={back}><ArrowLeft size={20} />Back to chat</Link>
        <h1 id="ai-create-title">Create a new AI friend</h1>
      </section>
    </main>
  );
}
