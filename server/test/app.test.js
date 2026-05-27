import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const claudeV3Response = {
  vocab: "退く",
  kana: "どく",
  pos: "自動詞・五段",
  meaning: "讓開；躲開；退讓；退出；離開",
  grammar: "ます形：退きます；て形：退いて。自動詞，常用於請對方讓開位置。",
  example_jp: "ちょっとどいてくれ。",
  example_zh: "請讓開一下。",
  notes: "「どく」多用於讓出空間；「しりぞく」偏向退出職位、戰線或位置。",
  jlpt_level: "N3",
  difficulty: "3",
  tags: ["日常", "口語", "移動", "自動詞", "N3"],
  collocations: "ちょっとどいて、そこをどく、席をどく、王位を退く、選挙戦から退く",
  nuance: "「どく」口語感強，常表示從某處讓開。",
  common_mistakes: "不要把簡體的「让开」保留原樣，台灣繁體應寫「讓開」。",
  memory_hook: "看到「どいて」可聯想到請人挪開、讓位。",
  review_status: "New",
  next_review: "2026-05-28",
  raw_moji_text: "退く②⓪\nどく\ndoku\n自動·五段\n簡明釋義\n让开；躲开；退让",
  conjugations: "ます形：退きます；て形：退いて",
  related_words: "他動詞：退かす（どかす）；多音詞：退く（しりぞく・のく・ひく・そく・しぞく）",
  synonyms: "引っ込む、引き下がる、引き上げる、下がる、引き揚げる",
  antonyms: "進む",
  all_examples: "1. ちょっとどいてくれ。— 請讓開一下。\n2. 私は王位を退き、息子に託します。— 我將退位並交託給兒子。",
};

describe("POST /api/moji-to-notion", () => {
  it("sends Moji text to Claude and creates a Notion page with full Moji analysis fields", async () => {
    const anthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify(claudeV3Response),
            },
          ],
        }),
      },
    };

    const notion = {
      pages: {
        create: vi.fn().mockResolvedValue({
          id: "notion-page-id",
          url: "https://notion.so/notion-page-id",
        }),
      },
    };

    const app = createApp({
      anthropic,
      notion,
      config: {
        notionDatabaseId: "database-id",
        claudeModel: "claude-test-model",
        allowedOrigin: "http://localhost:5173",
      },
    });

    const res = await request(app)
      .post("/api/moji-to-notion")
      .send({ mojiText: "退く②⓪\nどく\n让开；躲开；退让" })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.vocab).toBe("退く");
    expect(res.body.data.meaning).toContain("讓開");
    expect(res.body.data.all_examples).toContain("退位");
    expect(res.body.notionPageId).toBe("notion-page-id");
    expect(anthropic.messages.create).toHaveBeenCalledOnce();
    expect(notion.pages.create).toHaveBeenCalledOnce();
    expect(notion.pages.create.mock.calls[0][0].properties.JLPT_Level.select.name).toBe("N3");
    expect(notion.pages.create.mock.calls[0][0].properties.All_Examples.rich_text[0].text.content).toContain("退位");
  });

  it("returns 400 when mojiText is missing", async () => {
    const app = createApp({
      anthropic: { messages: { create: vi.fn() } },
      notion: { pages: { create: vi.fn() } },
      config: { notionDatabaseId: "database-id", claudeModel: "claude-test-model" },
    });

    const res = await request(app).post("/api/moji-to-notion").send({}).expect(400);
    expect(res.body.ok).toBe(false);
  });
});
