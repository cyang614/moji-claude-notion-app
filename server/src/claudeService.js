import { buildClaudeUserPrompt, CLAUDE_SYSTEM_PROMPT } from "./prompt.js";
import { parseClaudeJsonResponse } from "./claudeJson.js";

export async function analyzeMojiTextWithClaude({ anthropic, mojiText, model }) {
  if (!anthropic?.messages?.create) {
    throw new Error("Claude client 尚未正確初始化");
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    temperature: 0.2,
    system: CLAUDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildClaudeUserPrompt(mojiText),
      },
    ],
  });

  const textBlock = response.content?.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error("Claude 沒有回傳文字內容");
  }

  return parseClaudeJsonResponse(textBlock.text);
}
