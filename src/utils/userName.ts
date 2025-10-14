export const formatUserName = (
  first?: string | null,
  nickname?: string | null,
  last?: string | null
) => {
  const parts: string[] = [];

  if (first?.trim()) {
    parts.push(first.trim());
  }

  if (nickname?.trim()) {
    parts.push(`"${nickname.trim()}"`);
  }

  if (last?.trim()) {
    parts.push(last.trim());
  }

  if (parts.length === 0) {
    return "";
  }

  return parts.join(" ");
};

