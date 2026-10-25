export type Invite = { room: string; token: string };

export function parseInvite(value: string): Invite | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const parameters = new URLSearchParams(url.hash.slice(1));
    const room = parameters.get("room");
    const token = parameters.get("invite");
    return room && token ? { room, token } : null;
  } catch {
    return null;
  }
}

export function invitePath({ room, token }: Invite): string {
  return `/chat/join#${new URLSearchParams({ room, invite: token })}`;
}
