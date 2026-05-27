import { describe, expect, it } from "vitest";
import { buildNotionProperties } from "../src/notionMapper.js";

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
};

describe("Notion property mapper", () => {
  it("maps V3 vocab JSON into the expected Notion Database property schema", () => {
    const properties = buildNotionProperties(v3Data);

    expect(properties.Vocab.title[0].text.content).toBe("退く");
    expect(properties.Kana.rich_text[0].text.content).toBe("どく");
    expect(properties.POS.select.name).toBe("自動詞・五段");
    expect(properties.Example_ZH.rich_text[0].text.content).toContain("讓開");
    expect(properties.JLPT_Level.select.name).toBe("N3");
    expect(properties.Difficulty.select.name).toBe("3");
    expect(properties.Tags.multi_select).toEqual([
      { name: "日常" },
      { name: "口語" },
      { name: "移動" },
      { name: "自動詞" },
      { name: "N3" },
    ]);
    expect(properties.Conjugations.rich_text[0].text.content).toContain("退いて");
    expect(properties.Related_Words.rich_text[0].text.content).toContain("退かす");
    expect(properties.Synonyms.rich_text[0].text.content).toContain("引っ込む");
    expect(properties.Antonyms.rich_text[0].text.content).toBe("進む");
    expect(properties.All_Examples.rich_text[0].text.content).toContain("退位");
    expect(properties.Review_Status.select.name).toBe("New");
    expect(properties.Next_Review.date.start).toBe("2026-05-28");
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
    });

    expect(properties.Kana.rich_text).toEqual([]);
    expect(properties.POS.select).toBeNull();
    expect(properties.JLPT_Level.select).toBeNull();
    expect(properties.Tags.multi_select).toEqual([]);
    expect(properties.Next_Review.date).toBeNull();
    expect(properties.All_Examples.rich_text).toEqual([]);
  });

  it("splits long rich_text values into Notion-safe chunks", () => {
    const properties = buildNotionProperties({
      ...v3Data,
      all_examples: "例".repeat(2500),
    });

    expect(properties.All_Examples.rich_text.length).toBeGreaterThan(1);
    expect(properties.All_Examples.rich_text[0].text.content.length).toBeLessThanOrEqual(1900);
  });
});
