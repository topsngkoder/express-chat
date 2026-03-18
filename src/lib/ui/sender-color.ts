const SENDER_NAME_COLORS = [
  "#F07474",
  "#F4A261",
  "#E9C46A",
  "#2A9D8F",
  "#3A86FF",
  "#8338EC",
  "#FF006E",
  "#4CC9F0",
] as const;

export function hashSenderIdToColor(senderId: string): string {
  let hash = 0;
  for (let i = 0; i < senderId.length; i += 1) {
    hash = (hash * 31 + senderId.charCodeAt(i)) | 0;
  }

  const index = Math.abs(hash) % SENDER_NAME_COLORS.length;
  return SENDER_NAME_COLORS[index] ?? SENDER_NAME_COLORS[0];
}

