import { describe, expect, it } from "vitest";
import { buildNotionPageChildren, buildNotionProperties, buildReviewHistoryBlocks } from "../src/notionMapper.js";

const v3Data = {
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
  related_words: "他動詞：退かす（どかす）；多音詞：退く（しりぞく・のく・ひく・そく・しぞく）；話題詞：引く、戻る、離れる、下がる、遠ざかる",
  synonyms: "引っ込む、引き下がる、引き上げる、下がる、引き揚げる",
  antonyms: "進む",
  all_examples: "1. ちょっとどいてくれ。— 請讓開一下。\n2. 私は王位を退き、息子に託します。— 我將退位並交託給兒子。\n3. 選挙戦から退き、残りの任期に集中する。— 退出選戰，專注於剩餘任期。",
  kanji_readings: "退く（どく／しりぞく）、退かす（どかす）、王位（おうい）、選挙戦（せんきょせん）",
};

describe("Notion property mapper", () => {
  it("maps V3 vocab JSON into Taiwan Traditional Chinese Notion Database property names", () => {
    const properties = buildNotionProperties(v3Data);

    expect(properties["單字"].title[0].text.content).toBe("退く");
    expect(properties["讀音"].rich_text[0].text.content).toBe("どく");
    expect(properties["詞性"].select.name).toBe("自動詞・五段");
    expect(properties["例句翻譯"].rich_text[0].text.content).toContain("讓開");
    expect(properties["JLPT 等級"].select.name).toBe("N3");
    expect(properties["難度"].select.name).toBe("3");
    expect(properties["標籤"].multi_select).toEqual([
      { name: "日常" },
      { name: "口語" },
      { name: "移動" },
      { name: "自動詞" },
      { name: "N3" },
    ]);
    expect(properties["活用變化"].rich_text[0].text.content).toContain("退いて");
    expect(properties["關聯詞整理"].rich_text[0].text.content).toContain("退かす");
    expect(properties["近義詞"].rich_text[0].text.content).toContain("引っ込む");
    expect(properties["反義詞"].rich_text[0].text.content).toBe("進む");
    expect(properties["全部例句"].rich_text[0].text.content).toContain("退位");
    expect(properties["漢字假名對照"].rich_text[0].text.content).toContain("選挙戦（せんきょせん）");
    expect(properties["複習狀態"].select.name).toBe("New");
    expect(properties["下次複習日"].date.start).toBe("2026-05-28");
    expect(properties["目前間隔"].number).toBe(5);
    expect(properties["複習次數"].number).toBe(0);
    expect(properties["生疏次數"].number).toBe(0);
    expect(properties["上次複習日"].date).toBeNull();
    expect(properties["最近複習結果"].select).toBeNull();
  });

  it("uses empty rich_text arrays for empty values and avoids invalid empty selects", () => {
    const properties = buildNotionProperties({
      vocab: "未命名單字",
      kana: "",
      pos: "",
      meaning: "",
      grammar: "",
      example_jp: "",
      example_zh: "",
      notes: "",
      jlpt_level: "",
      difficulty: "",
      tags: [],
      collocations: "",
      nuance: "",
      common_mistakes: "",
      memory_hook: "",
      review_status: "",
      next_review: "",
      raw_moji_text: "",
      conjugations: "",
      related_words: "",
      synonyms: "",
      antonyms: "",
      all_examples: "",
      kanji_readings: "",
    });

    expect(properties["讀音"].rich_text).toEqual([]);
    expect(properties["詞性"].select).toBeNull();
    expect(properties["JLPT 等級"].select).toBeNull();
    expect(properties["標籤"].multi_select).toEqual([]);
    expect(properties["下次複習日"].date).toBeNull();
    expect(properties["目前間隔"].number).toBe(7);
    expect(properties["複習次數"].number).toBe(0);
    expect(properties["生疏次數"].number).toBe(0);
    expect(properties["上次複習日"].date).toBeNull();
    expect(properties["最近複習結果"].select).toBeNull();
    expect(properties["全部例句"].rich_text).toEqual([]);
    expect(properties["漢字假名對照"].rich_text).toEqual([]);
  });

  it("builds review history blocks for appending every review result to the Notion page body", () => {
    const blocks = buildReviewHistoryBlocks({
      reviewedAt: "2026-05-28",
      resultLabel: "一般",
      previousInterval: 3,
      newInterval: 8,
      reviewCount: 6,
      nextReviewDate: "2026-06-05",
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("bulleted_list_item");
    const serialized = JSON.stringify(blocks);
    expect(serialized).toContain("複習紀錄");
    expect(serialized).toContain("2026-05-28");
    expect(serialized).toContain("一般");
    expect(serialized).toContain("間隔 3 → 8 天");
    expect(serialized).toContain("第 6 次");
    expect(serialized).toContain("下次 2026-06-05");
  });

  it("truncates all_examples and raw_moji_text database properties while keeping full content in page body", () => {
    const longExamples = "例".repeat(2500);
    const longRawText = "原".repeat(2600);
    const properties = buildNotionProperties({
      ...v3Data,
      all_examples: longExamples,
      raw_moji_text: longRawText,
    });
    const children = buildNotionPageChildren({
      ...v3Data,
      all_examples: longExamples,
      raw_moji_text: longRawText,
    });
    const serializedChildren = JSON.stringify(children);

    expect(properties["全部例句"].rich_text).toHaveLength(1);
    expect(properties["全部例句"].rich_text[0].text.content).toHaveLength(1900);
    expect(properties["全部例句"].rich_text[0].text.content).toContain("（內容過長，完整版見頁面內文）");
    expect(properties["原始 Moji 文字"].rich_text).toHaveLength(1);
    expect(properties["原始 Moji 文字"].rich_text[0].text.content).toHaveLength(1900);
    expect(properties["原始 Moji 文字"].rich_text[0].text.content).toContain("（內容過長，完整版見頁面內文）");
    expect(serializedChildren).toContain("例".repeat(1900));
    expect(serializedChildren).toContain("原".repeat(1900));
  });

  it("builds page body blocks containing all Claude content and kanji-kana readings", () => {
    const children = buildNotionPageChildren(v3Data);
    const serialized = JSON.stringify(children);

    expect(children[0].type).toBe("heading_2");
    expect(serialized).toContain("Claude 整理內容");
    expect(serialized).toContain("漢字假名對照");
    expect(serialized).toContain("退く（どく／しりぞく）");
    expect(serialized).toContain("全部例句");
    expect(serialized).toContain("我將退位並交託給兒子");
  });
});
