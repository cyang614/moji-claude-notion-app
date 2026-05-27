const DEFAULT_PROPERTY_NAMES = {
  vocab: "Vocab",
  kana: "Kana",
  pos: "POS",
  meaning: "Meaning",
  grammar: "Grammar",
  example_jp: "Example_JP",
  example_zh: "Example_ZH",
  notes: "Notes",
  jlpt_level: "JLPT_Level",
  difficulty: "Difficulty",
  tags: "Tags",
  collocations: "Collocations",
  nuance: "Nuance",
  common_mistakes: "Common_Mistakes",
  memory_hook: "Memory_Hook",
  review_status: "Review_Status",
  next_review: "Next_Review",
  raw_moji_text: "Raw_Moji_Text",
  conjugations: "Conjugations",
  related_words: "Related_Words",
  synonyms: "Synonyms",
  antonyms: "Antonyms",
  all_examples: "All_Examples",
};

function textContent(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function selectOption(value, maxLength = 100) {
  const content = textContent(value).slice(0, maxLength);
  return content ? { name: content } : null;
}

function multiSelectOptions(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => textContent(value).slice(0, 100)).filter(Boolean))]
    .slice(0, 10)
    .map((name) => ({ name }));
}

function dateValue(value) {
  const content = textContent(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(content)) return null;
  return { start: content };
}

export function toTitle(value) {
  const content = textContent(value, "未命名單字").slice(0, 2000) || "未命名單字";
  return [{ type: "text", text: { content } }];
}

export function toRichText(value) {
  const content = textContent(value);
  if (!content) return [];

  const chunks = [];
  for (let i = 0; i < content.length; i += 1900) {
    chunks.push({ type: "text", text: { content: content.slice(i, i + 1900) } });
  }
  return chunks;
}

export function buildNotionProperties(data, propertyNames = DEFAULT_PROPERTY_NAMES) {
  return {
    [propertyNames.vocab]: { title: toTitle(data.vocab) },
    [propertyNames.kana]: { rich_text: toRichText(data.kana) },
    [propertyNames.pos]: { select: selectOption(data.pos) },
    [propertyNames.meaning]: { rich_text: toRichText(data.meaning) },
    [propertyNames.grammar]: { rich_text: toRichText(data.grammar) },
    [propertyNames.example_jp]: { rich_text: toRichText(data.example_jp) },
    [propertyNames.example_zh]: { rich_text: toRichText(data.example_zh) },
    [propertyNames.notes]: { rich_text: toRichText(data.notes) },
    [propertyNames.jlpt_level]: { select: selectOption(data.jlpt_level) },
    [propertyNames.difficulty]: { select: selectOption(data.difficulty) },
    [propertyNames.tags]: { multi_select: multiSelectOptions(data.tags) },
    [propertyNames.collocations]: { rich_text: toRichText(data.collocations) },
    [propertyNames.nuance]: { rich_text: toRichText(data.nuance) },
    [propertyNames.common_mistakes]: { rich_text: toRichText(data.common_mistakes) },
    [propertyNames.memory_hook]: { rich_text: toRichText(data.memory_hook) },
    [propertyNames.review_status]: { select: selectOption(data.review_status) },
    [propertyNames.next_review]: { date: dateValue(data.next_review) },
    [propertyNames.raw_moji_text]: { rich_text: toRichText(data.raw_moji_text) },
    [propertyNames.conjugations]: { rich_text: toRichText(data.conjugations) },
    [propertyNames.related_words]: { rich_text: toRichText(data.related_words) },
    [propertyNames.synonyms]: { rich_text: toRichText(data.synonyms) },
    [propertyNames.antonyms]: { rich_text: toRichText(data.antonyms) },
    [propertyNames.all_examples]: { rich_text: toRichText(data.all_examples) },
  };
}
