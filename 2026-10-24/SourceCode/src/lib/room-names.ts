export const ROOM_NAME_LIMIT = 60;

// Match PostgreSQL char_length: count Unicode code points, not UTF-16 units.
export function validateRoomName(value: string): string | null {
  const length = Array.from(value.trim()).length;
  if (!length) return "Enter a group name.";
  return length > ROOM_NAME_LIMIT ? "Use 60 characters or fewer." : null;
}
