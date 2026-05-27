import { describe, expect, it, vi } from "vitest";
import { analyzeMojiTextWithClaude } from "../src/claudeService.js";

const toolInput = {
  vocab: "退く",
  kana: "どく",
  pos: "自動詞・五段",
  meaning: "让开；躲开；退让",
  grammar: "ます形：退きます；て形：退いて。",
  example_jp: "ちょっとどいてくれ。",
  example_zh: "躲开点！",
  notes: "口語中常用於請對方讓出位置。",
  jlpt_level: "N3",
  difficulty: "3",
  tags: ["日常", "口語", "自動詞"],
  collocations: "ちょっとどいて、席をどく",
  nuance: "口語感強。",
  common_mistakes: "注意與「しりぞく」讀音差異。",
  memory_hook: "どいて＝讓一下。",
  review_status: "New",
  next_review: "2026-05-28",
  raw_moji_text: "退く②⓪\nどく\n让开；躲开；退让",
  conjugations: "ます形：退きます；て形：退いて",
  related_words: "他動詞：退かす（どかす）",
  synonyms: "引っ込む、下がる",
  antonyms: "進む",
  all_examples: "1. ちょっとどいてくれ。— 躲開點！",
  kanji_readings: "退く（どく／しりぞく）、退かす（どかす）",
};

describe("analyzeMojiTextWithClaude", () => {
  it("forces Claude tool use and reads structured JSON from tool_use input", async () => {
    const anthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "save_moji_vocab",
              input: toolInput,
            },
          ],
        }),
      },
    };

    const data = await analyzeMojiTextWithClaude({
      anthropic,
      mojiText: "退く②⓪\nどく\n让开；躲开；退让",
      model: "claude-test-model",
    });

    const payload = anthropic.messages.create.mock.calls[0][0];
    expect(payload.tools[0].name).toBe("save_moji_vocab");
    expect(payload.tool_choice).toEqual({ type: "tool", name: "save_moji_vocab" });
    expect(payload.tools[0].input_schema.required).toContain("kanji_readings");
    expect(data.vocab).toBe("退く");
    expect(data.kanji_readings).toContain("退かす");
    expect(data.meaning).toContain("讓開");
    expect(data.example_zh).toBe("躲開點！");
  });

  it("keeps text JSON parsing as a fallback for older mocked or non-tool responses", async () => {
    const anthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify(toolInput),
            },
          ],
        }),
      },
    };

    const data = await analyzeMojiTextWithClaude({
      anthropic,
      mojiText: "退く②⓪\nどく",
      model: "claude-test-model",
    });

    expect(data.vocab).toBe("退く");
  });
});
