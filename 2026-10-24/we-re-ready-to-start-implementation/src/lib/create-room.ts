import { validateNickname } from "./nicknames";
import { identity } from "./identity";
import { browserDb } from "./supabase";
import { validateRoomName } from "./room-names";

export async function createRoom(name: string, displayName: string): Promise<string> {
  const validation = validateRoomName(name) || validateNickname(displayName);
  if (validation) throw new Error(validation);
  await identity();
  const { data, error } = await browserDb().rpc("create_room", {
    p_name: name.trim(),
    p_display_name: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}
