import { describe, expect, it } from "vitest";
import { exportMessages, findMessageMatches } from "@/lib/chat-tools";

describe("Chat tools", () => {
  const messages = [{ role: "user", content: "اكتب Python" }, { role: "assistant", content: "Python code" }, { role: "assistant", content: "نص آخر" }];
  it("finds all matching messages regardless of Latin letter case", () => { expect(findMessageMatches(messages, " python ")).toEqual([0, 1]); expect(findMessageMatches(messages, "مفقود")).toEqual([]); });
  it("does not treat an empty search as a match", () => { expect(findMessageMatches(messages, "  ")).toEqual([]); });
  it("exports role and content without private message fields", () => { expect(JSON.parse(exportMessages([{ ...messages[0], id: "private-id" } as typeof messages[0]], "json"))).toEqual([messages[0]]); });
});