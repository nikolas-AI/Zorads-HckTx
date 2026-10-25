import { browserDb } from './supabase';
import type { FriendConfig } from './friend-presets';
export async function saveStudioFriend(id:string|null, source:string|null, form:FriendConfig):Promise<string> {
 const {data,error}=await browserDb().rpc('save_studio_friend',{p_id:id,p_source:source,p_config:form});
 if(error)throw new Error(error.code==='PGRST202'?'Apply migration 004 to enable the friend library.':error.message);
 return data;
}
export async function addToRoom(friend:string,room:string) {
 const {data,error}=await browserDb().rpc('add_friend_to_room',{p_friend:friend,p_room:room});
 if(error)throw new Error(error.message); return data as string;
}
export async function startFriendChat(friends:string[],name:string) {
 const {data,error}=await browserDb().rpc('start_friend_chat',{p_friends:friends,p_display_name:name});
 if(error)throw new Error(error.message); return data as string;
}
export async function removeFriend(roomId:string,id:string) {
 const {error}=await browserDb().rpc('remove_friend',{p_room:roomId,p_id:id});
 if(error)throw new Error(error.message);
}
