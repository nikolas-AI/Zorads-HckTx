import { browserDb } from "./supabase";

type FriendConfiguration = {
  name: string;
  personality: string;
  specialty: string;
  avatar: string;
  system_prompt: string;
};

export async function saveFriend(roomId: string, id: string | null, form: FriendConfiguration) {
  const { error } = await browserDb().rpc("save_friend", {
    p_room: roomId, p_id: id, p_name: form.name.trim(),
    p_personality: form.personality.trim(), p_interests: form.specialty.trim(),
    p_avatar: form.avatar, p_instructions: form.system_prompt.trim(),
  });
  if (error) throw new Error(error.code === "PGRST202" ? "Apply the Agent Studio database migration to create friends." : error.message);
}

export async function removeFriend(roomId: string, id: string) {
  const { error } = await browserDb().rpc("remove_friend", { p_room: roomId, p_id: id });
  if (error) throw new Error(error.message);
}
