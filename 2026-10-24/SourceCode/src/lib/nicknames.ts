export function validateNickname(value: string): string | null {
  const length = Array.from(value.trim()).length;
  if (!length) return "Enter your nickname.";
  return length > 32 ? "Use 32 characters or fewer for your nickname." : null;
}
