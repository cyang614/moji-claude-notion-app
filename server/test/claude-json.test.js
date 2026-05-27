import { describe, expect, it } from "vitest";
import { parseClaudeJsonResponse, validateVocabData } from "../src/claudeJson.js";

const v3Json = {
  vocab: "退く",
  kana: "どく",
  pos: "自動詞・五段",
  meaning: "讓開；躲開；退讓；退出；離開",
  grammar: "ます形：退きます；て形：退いて。自動詞，常用於請對方讓開位置，例如「ちょっとどいてくれ」。",
  example_jp: "ちょっとどいてくれ。",
  example_zh: "請讓開一下。",
  notes: "「どく」多用於讓出空間；「しりぞく」偏向退出職位、戰線或位置。",
  jlpt_level: "N3",
  difficulty: "3",
  tags: ["日常", "口語", "移動", "自動詞", "N3"],
  collocations: "ちょっとどいて、そこをどく、席をどく、王位を退く、選挙戦から退く",
  nuance: "「どく」口語感強，常表示從某處讓開；新聞中的「王位を退く」「選挙戦から退く」則讀作或語感更接近「しりぞく」。",
  common_mistakes: "不要把簡體的「让开」保留原樣，台灣繁體應寫「讓開」。也要注意「退く」依讀音不同，意思與使用情境會改變。",
  memory_hook: "看到「どいて」可聯想到請人『挪開、讓位』；看到王位或選戰，多半是『退位、退出』。",
  review_status: "New",
  next_review: "2026-05-28",
  raw_moji_text: "退く②⓪\nどく\ndoku\n自動·五段\n簡明釋義\n让开；躲开；退让",
  conjugations: "ます形：退きます；て形：退いて",
  related_words: "他動詞：退かす（どかす）；多音詞：退く（しりぞく・のく・ひく・そく・しぞく）；話題詞：引く、戻る、離れる、下がる、遠ざかる；英語：step aside, step back, turn aside",
  synonyms: "引っ込む、引き下がる、引き上げる、下がる、引き揚げる",
  antonyms: "進む",
  all_examples: "1. ちょっとどいてくれ。— 請讓開一下。\n2. 私は王位を退き、息子に託します。— 我將退位並交託給兒子。\n3. 選挙戦から退き、残りの任期に集中する。— 退出選戰，專注於剩餘任期。",
};

describe("Claude JSON parsing", () => {
  it("parses a strict V3 JSON object from Claude text", () => {
    const data = parseClaudeJsonResponse(JSON.stringify(v3Json));

    expect(data.vocab).toBe("退く");
    expect(data.example_zh).toContain("請讓開");
    expect(data.jlpt_level).toBe("N3");
    expect(data.tags).toEqual(["日常", "口語", "移動", "自動詞", "N3"]);
    expect(data.conjugations).toContain("退いて");
    expect(data.related_words).toContain("退かす");
    expect(data.synonyms).toContain("引っ込む");
    expect(data.antonyms).toBe("進む");
    expect(data.all_examples).toContain("退位");
    expect(data.common_mistakes).toMatch(/台灣繁體|臺灣繁體/);
  });

  it("also tolerates accidental markdown fences without breaking", () => {
    const data = parseClaudeJsonResponse(`\`\`\`json\n${JSON.stringify({
      ...v3Json,
      vocab: "猫",
      kana: "ねこ",
      pos: "名詞",
      meaning: "貓",
      grammar: "",
      example_jp: "猫がいます。",
      example_zh: "有一隻貓。",
      notes: "可用「猫を飼う」表示養貓。",
      jlpt_level: "N5",
      tags: ["動物", "日常"],
    })}\n\`\`\``);
    expect(data.vocab).toBe("猫");
    expect(data.tags).toEqual(["動物", "日常"]);
  });

  it("rejects data when required fields are missing", () => {
    expect(() => validateVocabData({ vocab: "猫" })).toThrow(/缺少欄位/);
  });

  it("normalizes V3 optional fields to safe defaults", () => {
    const data = validateVocabData({
      vocab: "猫",
      kana: "ねこ",
      pos: "名詞",
      meaning: "貓",
      grammar: "",
      example_jp: "猫がいます。",
      example_zh: "有一隻貓。",
      notes: "可用「猫を飼う」表示養貓。",
    });

    expect(data.jlpt_level).toBe("Unknown");
    expect(data.difficulty).toBe("3");
    expect(data.tags).toEqual([]);
    expect(data.review_status).toBe("New");
    expect(data.next_review).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.conjugations).toBe("");
    expect(data.related_words).toBe("");
    expect(data.synonyms).toBe("");
    expect(data.antonyms).toBe("");
    expect(data.all_examples).toBe("");
  });

  it("normalizes simplified Chinese into Taiwan traditional Chinese for Chinese output fields", () => {
    const data = validateVocabData({
      vocab: "退く",
      kana: "どく",
      pos: "自動詞・五段",
      meaning: "让开；躲开；退让；离开",
      grammar: "请别人让开时可用「どいて」。",
      example_jp: "ちょっとどいてくれ。",
      example_zh: "躲开点！",
      notes: "不要保留简体中文。",
      all_examples: "1. ちょっとどいてくれ。— 躲开点！",
    });

    expect(data.meaning).toContain("讓開");
    expect(data.meaning).toContain("離開");
    expect(data.grammar).toContain("請別人讓開");
    expect(data.example_zh).toBe("躲開點！");
    expect(data.notes).toContain("簡體中文");
    expect(data.all_examples).toContain("躲開點");
  });
});
