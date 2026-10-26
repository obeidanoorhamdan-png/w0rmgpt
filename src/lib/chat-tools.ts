export type ChatMessage = { role: string; content: string };

export function findMessageMatches(messages: ChatMessage[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  return messages.flatMap((message, index) => message.content.toLocaleLowerCase().includes(term) ? [index] : []);
}

export function exportMessages(messages: ChatMessage[], format: "md" | "json") {
  if (format === "json") return JSON.stringify(messages.map(({ role, content }) => ({ role, content })), null, 2);
  return messages.map(message => `## ${message.role === "user" ? "أنت" : "WORM GPT"}\n\n${message.content}`).join("\n\n---\n\n");
}