import { describe, expect, it } from "vitest";
import { buildClaudeUserPrompt, CLAUDE_SYSTEM_PROMPT } from "../src/prompt.js";

describe("Claude prompt", () => {
  it("keeps the system prompt strict and inserts the actual Moji text in the user prompt", () => {
    const mojiText = "退く②⓪\nどく\n簡明釋義\n让开；躲开；退让";
    const prompt = buildClaudeUserPrompt(mojiText);

    expect(CLAUDE_SYSTEM_PROMPT).toContain("嚴格");
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"vocab"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"jlpt_level"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"tags"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"memory_hook"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"all_examples"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"conjugations"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain("所有例句");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("簡體中文");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("台灣繁體");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("台灣學習者");
    expect(prompt).toContain(mojiText);
    expect(prompt).toContain("<moji_text>");
    expect(prompt).not.toContain("[在此處插入使用者輸入的原始文字]");
  });
});
