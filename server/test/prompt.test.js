import { afterEach, describe, expect, it, vi } from "vitest";
import { buildClaudeUserPrompt, CLAUDE_SYSTEM_PROMPT } from "../src/prompt.js";

describe("Claude prompt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(CLAUDE_SYSTEM_PROMPT).toContain('"kanji_readings"');
    expect(CLAUDE_SYSTEM_PROMPT).toContain("漢字假名對照");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("簡體中文");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("台灣繁體");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("台灣學習者");
    expect(prompt).toContain(mojiText);
    expect(prompt).toContain("<moji_text>");
    expect(prompt).not.toContain("[在此處插入使用者輸入的原始文字]");
  });

  it("injects today's date into the user prompt and requires next_review calculation by JLPT level", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:34:56.000Z"));

    const prompt = buildClaudeUserPrompt("猫\nねこ");

    expect(prompt).toContain("今天日期：2026-05-27");
    expect(prompt).toContain("<today>2026-05-27</today>");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("13. 今天日期會在 User Input 中提供");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("N5/N4 = 今天 +3 天");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("N3 = +5 天");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("N2/N1 = +7 天");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("Unknown = +7 天");
    expect(CLAUDE_SYSTEM_PROMPT).toContain("根據 jlpt_level 與今天日期計算，必須填入 YYYY-MM-DD 格式");
    expect(CLAUDE_SYSTEM_PROMPT).not.toContain("若無法確定今天日期，填空字串；後端會補預設值");
  });
});
