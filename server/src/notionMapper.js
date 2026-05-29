export const DEFAULT_PROPERTY_NAMES = {
  vocab: "單字",
  kana: "讀音",
  pos: "詞性",
  meaning: "中文意思",
  grammar: "文法重點",
  example_jp: "核心例句（日文）",
  example_zh: "例句翻譯",
  notes: "學習筆記",
  jlpt_level: "JLPT 等級",
  difficulty: "難度",
  tags: "標籤",
  collocations: "常用搭配",
  nuance: "語感",
  common_mistakes: "常見錯誤",
  memory_hook: "記憶法",
  review_status: "複習狀態",
  next_review: "下次複習日",
  current_interval: "目前間隔",
  review_count: "複習次數",
  lapse_count: "生疏次數",
  last_reviewed: "上次複習日",
  last_review_result: "最近複習結果",
  raw_moji_text: "原始 Moji 文字",
  conjugations: "活用變化",
  related_words: "關聯詞整理",
  synonyms: "近義詞",
  antonyms: "反義詞",
  all_examples: "全部例句",
  kanji_readings: "漢字假名對照",
};

const TRUNCATED_PROPERTY_NOTICE = "（內容過長，完整版見頁面內文）";
const MAX_LONG_PROPERTY_LENGTH = 1900;

const PAGE_SECTIONS = [
  ["單字", "vocab"],
  ["讀音", "kana"],
  ["詞性", "pos"],
  ["中文意思", "meaning"],
  ["漢字假名對照", "kanji_readings"],
  ["文法重點", "grammar"],
  ["核心例句（日文）", "example_jp"],
  ["例句翻譯", "example_zh"],
  ["學習筆記", "notes"],
  ["JLPT 等級", "jlpt_level"],
  ["難度", "difficulty"],
  ["標籤", "tags"],
  ["常用搭配", "collocations"],
  ["語感", "nuance"],
  ["常見錯誤", "common_mistakes"],
  ["記憶法", "memory_hook"],
  ["活用變化", "conjugations"],
  ["關聯詞整理", "related_words"],
  ["近義詞", "synonyms"],
  ["反義詞", "antonyms"],
  ["全部例句", "all_examples"],
  ["原始 Moji 文字", "raw_moji_text"],
];

function textContent(value, fallback = "") {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean).join("、");
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

function numberValue(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function initialReviewInterval(jlptLevel) {
  const level = textContent(jlptLevel);
  if (["N5", "N4"].includes(level)) return 3;
  if (level === "N3") return 5;
  return 7;
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

function toTruncatedPropertyRichText(value) {
  const content = textContent(value);
  if (!content) return [];

  if (content.length <= MAX_LONG_PROPERTY_LENGTH) {
    return toRichText(content);
  }

  const prefixLength = MAX_LONG_PROPERTY_LENGTH - TRUNCATED_PROPERTY_NOTICE.length;
  return toRichText(`${content.slice(0, prefixLength)}${TRUNCATED_PROPERTY_NOTICE}`);
}

function heading(level, content) {
  const type = `heading_${level}`;
  return {
    object: "block",
    type,
    [type]: { rich_text: toRichText(content) },
  };
}

function paragraph(content) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: toRichText(content) },
  };
}

function divider() {
  return { object: "block", type: "divider", divider: {} };
}

function sectionBlocks(label, value) {
  const content = textContent(value);
  if (!content) return [];

  const blocks = [heading(3, label)];
  for (let i = 0; i < content.length; i += 1900) {
    blocks.push(paragraph(content.slice(i, i + 1900)));
  }
  return blocks;
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
    [propertyNames.current_interval]: { number: numberValue(data.current_interval, initialReviewInterval(data.jlpt_level)) },
    [propertyNames.review_count]: { number: numberValue(data.review_count, 0) },
    [propertyNames.lapse_count]: { number: numberValue(data.lapse_count, 0) },
    [propertyNames.last_reviewed]: { date: dateValue(data.last_reviewed) },
    [propertyNames.last_review_result]: { select: selectOption(data.last_review_result) },
    [propertyNames.raw_moji_text]: { rich_text: toTruncatedPropertyRichText(data.raw_moji_text) },
    [propertyNames.conjugations]: { rich_text: toRichText(data.conjugations) },
    [propertyNames.related_words]: { rich_text: toRichText(data.related_words) },
    [propertyNames.synonyms]: { rich_text: toRichText(data.synonyms) },
    [propertyNames.antonyms]: { rich_text: toRichText(data.antonyms) },
    [propertyNames.all_examples]: { rich_text: toTruncatedPropertyRichText(data.all_examples) },
    [propertyNames.kanji_readings]: { rich_text: toRichText(data.kanji_readings) },
  };
}

export function buildNotionPageChildren(data) {
  const children = [
    heading(2, "Claude 整理內容"),
    paragraph(`單字：${textContent(data.vocab, "—")}｜讀音：${textContent(data.kana, "—")}｜詞性：${textContent(data.pos, "—")}`),
    divider(),
  ];

  for (const [label, key] of PAGE_SECTIONS) {
    children.push(...sectionBlocks(label, data[key]));
  }

  return children.slice(0, 100);
}

export function buildReviewHistoryBlocks({
  reviewedAt,
  resultLabel,
  previousInterval,
  newInterval,
  reviewCount,
  nextReviewDate,
}) {
  const summary = `複習紀錄｜${reviewedAt}｜${resultLabel}｜間隔 ${previousInterval} → ${newInterval} 天｜第 ${reviewCount} 次｜下次 ${nextReviewDate}`;
  return [
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: toRichText(summary) },
    },
  ];
}
