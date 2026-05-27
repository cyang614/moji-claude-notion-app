import { buildClaudeUserPrompt, CLAUDE_SYSTEM_PROMPT } from "./prompt.js";
import { parseClaudeJsonResponse, validateVocabData } from "./claudeJson.js";

const SAVE_MOJI_VOCAB_TOOL = {
  name: "save_moji_vocab",
  description: "Return the cleaned Moji dictionary vocabulary analysis as structured JSON for Notion import.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "vocab",
      "kana",
      "pos",
      "meaning",
      "grammar",
      "example_jp",
      "example_zh",
      "notes",
      "jlpt_level",
      "difficulty",
      "tags",
      "collocations",
      "nuance",
      "common_mistakes",
      "memory_hook",
      "review_status",
      "next_review",
      "raw_moji_text",
      "conjugations",
      "related_words",
      "synonyms",
      "antonyms",
      "all_examples",
    ],
    properties: {
      vocab: { type: "string", description: "日文漢字或假名" },
      kana: { type: "string", description: "主讀音，平假名或片假名" },
      pos: { type: "string", description: "詞性，例如 自動詞・五段" },
      meaning: { type: "string", description: "台灣繁體中文核心釋義" },
      grammar: { type: "string", description: "文法、活用、接續或讀音差異解析；若無則空字串" },
      example_jp: { type: "string", description: "最具代表性的日文例句" },
      example_zh: { type: "string", description: "例句台灣繁體中文翻譯" },
      notes: { type: "string", description: "1-2 句學習筆記" },
      jlpt_level: { type: "string", enum: ["N5", "N4", "N3", "N2", "N1", "Unknown"] },
      difficulty: { type: "string", enum: ["1", "2", "3", "4", "5"] },
      tags: {
        type: "array",
        minItems: 0,
        maxItems: 10,
        items: { type: "string" },
        description: "適合 Notion multi-select 的台灣繁體中文短標籤",
      },
      collocations: { type: "string", description: "常用搭配詞、慣用句或助詞搭配" },
      nuance: { type: "string", description: "語感、正式度、使用情境" },
      common_mistakes: { type: "string", description: "台灣學習者常見錯誤" },
      memory_hook: { type: "string", description: "記憶法或聯想" },
      review_status: { type: "string", enum: ["New"] },
      next_review: { type: "string", description: "YYYY-MM-DD 或空字串" },
      raw_moji_text: { type: "string", description: "原始 Moji 文字整理，中文需轉成台灣繁體" },
      conjugations: { type: "string", description: "活用變化，例如 ます形、て形" },
      related_words: { type: "string", description: "關聯詞、同詞位、多音詞、話題詞、外語關聯詞" },
      synonyms: { type: "string", description: "近義詞" },
      antonyms: { type: "string", description: "反義詞" },
      all_examples: { type: "string", description: "所有有學習價值的例句與台灣繁體中文翻譯，使用編號文字" },
    },
  },
};

function getResponseText(response) {
  return response.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function getToolInput(response) {
  const toolBlock = response.content?.find(
    (block) => block.type === "tool_use" && block.name === SAVE_MOJI_VOCAB_TOOL.name
  );
  return toolBlock?.input;
}

export async function analyzeMojiTextWithClaude({ anthropic, mojiText, model }) {
  if (!anthropic?.messages?.create) {
    throw new Error("Claude client 尚未正確初始化");
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    temperature: 0.1,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildClaudeUserPrompt(mojiText),
      },
    ],
    tools: [SAVE_MOJI_VOCAB_TOOL],
    tool_choice: { type: "tool", name: SAVE_MOJI_VOCAB_TOOL.name },
  });

  const toolInput = getToolInput(response);
  if (toolInput) {
    return validateVocabData(toolInput);
  }

  const text = getResponseText(response);
  if (text) {
    return parseClaudeJsonResponse(text);
  }

  throw new Error("Claude 沒有回傳可解析的結構化資料");
}
