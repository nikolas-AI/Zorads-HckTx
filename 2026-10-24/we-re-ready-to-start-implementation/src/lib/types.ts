export type AgentId = string;
export type Agent = { id: AgentId; name: string; specialty: string; personality: string; avatar: string; system_prompt: string; room_id?: string | null; owner_id?: string | null; archived?: boolean };
export type Room = { id: string; name: string; created_at: string };
export type Member = { user_id: string; display_name: string };
export type Message = { id: string; room_id: string; user_id: string | null; sender_name: string; agent_id: AgentId | null; content: string; status: "complete" | "pending" | "generating" | "failed"; created_at: string; parent_id: string | null };

