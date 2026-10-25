import { identity } from "./identity";
import { browserDb } from "./supabase";
import { validateNickname } from "./nicknames";
import type { Invite } from "./invites";

export async function joinRoom(invite: Invite, nickname: string): Promise<string> {
  const validation = validateNickname(nickname);
  if (validation) throw new Error(validation);
  await identity();
  const { data, error } = await browserDb().rpc("join_room", {
    p_room: invite.room,
    p_invite: invite.token,
    p_display_name: nickname.trim(),
  });
  if (error) throw new Error(error.message);
  return data;
}
