import { Converter } from "opencc-js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const toTaiwanTraditional = Converter({ from: "cn", to: "twp" });
const TAIWAN_TRADITIONAL_FIELDS = [
  "meaning",
  "grammar",
  "example_zh",
  "notes",
  "nuance",
  "common_mistakes",
  "memory_hook",
  "raw_moji_text",
  "all_examples",
];

export const REQUIRED_VOCAB_FIELDS = [
  "vocab",
  "kana",
  "pos",
  "meaning",
  "grammar",
  "example_jp",
  "example_zh",
  "notes",
];

export const OPTIONAL_TEXT_VOCAB_FIELDS = [
  "collocations",
  "nuance",
  "common_mistakes",
  "memory_hook",
  "raw_moji_text",
  "conjugations",
  "related_words",
  "synonyms",
  "antonyms",
  "all_examples",
];

export const V2_OPTIONAL_VOCAB_FIELDS = [
  "jlpt_level",
  "difficulty",
  "tags",
  ...OPTIONAL_TEXT_VOCAB_FIELDS,
  "review_status",
  "next_review",
];

function tomorrowIsoDate(now = new Date()) {
  return new Date(now.getTime() + ONE_DAY_MS).toISOString().slice(0, 10);
}

function cleanString(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function localizeTaiwanTraditional(data) {
  return Object.fromEntries(
    Object.entries(data).map(([field, value]) => [
      field,
      TAIWAN_TRADITIONAL_FIELDS.includes(field) ? toTaiwanTraditional(value) : value,
    ])
  );
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((tag) => cleanString(tag)).filter(Boolean))].slice(0, 10);
  }

  if (typeof value === "string") {
    return [...new Set(value.split(/[、,，\n]/).map((tag) => cleanString(tag)).filter(Boolean))].slice(0, 10);
  }

  return [];
}

function normalizeIsoDate(value, fallback = tomorrowIsoDate()) {
  const text = cleanString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return fallback;
}

export function extractJsonObject(text) {
  if (typeof text !== "string") {
    throw new Error("Claude 回傳內容不是文字");
  }

  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Claude 回傳內容中找不到 JSON 物件");
  }

  return cleaned.slice(start, end + 1);
}

export function validateVocabData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Claude 回傳 JSON 不是物件");
  }

  for (const field of REQUIRED_VOCAB_FIELDS) {
    if (!(field in data)) {
      throw new Error(`Claude 回傳 JSON 缺少欄位：${field}`);
    }
  }

  const normalized = Object.fromEntries(
    REQUIRED_VOCAB_FIELDS.map((field) => [field, cleanString(data[field])])
  );

  const optionalText = Object.fromEntries(
    OPTIONAL_TEXT_VOCAB_FIELDS.map((field) => [field, cleanString(data[field])])
  );

  return localizeTaiwanTraditional({
    ...normalized,
    jlpt_level: cleanString(data.jlpt_level, "Unknown"),
    difficulty: cleanString(data.difficulty, "3"),
    tags: normalizeTags(data.tags),
    ...optionalText,
    review_status: cleanString(data.review_status, "New"),
    next_review: normalizeIsoDate(data.next_review),
  });
}

export function parseClaudeJsonResponse(text) {
  const jsonText = extractJsonObject(text);

  try {
    return validateVocabData(JSON.parse(jsonText));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Claude 回傳 JSON 格式不正確：${error.message}`);
    }
    throw error;
  }
}
