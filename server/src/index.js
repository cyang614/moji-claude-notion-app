import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { Client as NotionClient } from "@notionhq/client";
import { createApp } from "./app.js";

dotenv.config();

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const notion = process.env.NOTION_API_KEY
  ? new NotionClient({ auth: process.env.NOTION_API_KEY })
  : null;

const app = createApp({
  anthropic,
  notion,
  config: {
    notionDatabaseId: process.env.NOTION_DATABASE_ID,
    notionDataSourceId: process.env.NOTION_DATA_SOURCE_ID,
    claudeModel: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest",
    allowedOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});
