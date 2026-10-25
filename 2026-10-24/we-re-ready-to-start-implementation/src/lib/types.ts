export type AgentId = string;
export type Agent = { id: AgentId; name: string; specialty: string; personality: string; avatar: string; system_prompt: string; room_id?: string | null; owner_id?: string | null; archived?: boolean; source_id?: string | null; skills?: string[]; allow_template?: boolean; allow_group_edit?: boolean };
export type Room = { id: string; name: string; created_at: string; ai_only?: boolean };
export type Member = { user_id: string; display_name: string };
export type Message = { event_type?: "companion_added" | "companion_removed" | null; id: string; room_id: string; user_id: string | null; sender_name: string; agent_id: AgentId | null; content: string; status: "complete" | "pending" | "generating" | "failed"; created_at: string; parent_id: string | null };
