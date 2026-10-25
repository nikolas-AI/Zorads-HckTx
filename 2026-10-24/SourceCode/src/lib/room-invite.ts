import { browserDb } from "./supabase";
import { invitePath } from "./invites";

export async function roomInviteLink(room: string, origin: string): Promise<string> {
  const { data, error } = await browserDb().rpc("room_invite", { p_room: room });
  if (error) throw new Error("Could not load the invite link. Try again.");
  if (!data) throw new Error("This room has no invite link.");
  return `${origin}${invitePath({ room, token: data })}`;
}
