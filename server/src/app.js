import express from "express";
import cors from "cors";
import { analyzeMojiTextWithClaude } from "./claudeService.js";
import { buildNotionProperties } from "./notionMapper.js";

export function createApp({ anthropic, notion, config }) {
  const app = express();
  const allowedOrigin = config.allowedOrigin || "http://localhost:5173";

  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "moji-claude-notion-server",
      hasClaudeClient: Boolean(anthropic),
      hasNotionClient: Boolean(notion),
      hasNotionDatabaseId: Boolean(config.notionDatabaseId),
    });
  });

  app.post("/api/moji-to-notion", async (req, res) => {
    try {
      const { mojiText } = req.body;

      if (!mojiText || typeof mojiText !== "string" || !mojiText.trim()) {
        return res.status(400).json({ ok: false, message: "請提供 mojiText 字串" });
      }

      if (!anthropic) {
        return res.status(500).json({ ok: false, message: "後端缺少 ANTHROPIC_API_KEY" });
      }

      if (!notion) {
        return res.status(500).json({ ok: false, message: "後端缺少 NOTION_API_KEY" });
      }

      if (!config.notionDatabaseId) {
        return res.status(500).json({ ok: false, message: "後端缺少 NOTION_DATABASE_ID" });
      }

      const structuredData = await analyzeMojiTextWithClaude({
        anthropic,
        mojiText: mojiText.trim(),
        model: config.claudeModel,
      });

      const notionPage = await notion.pages.create({
        parent: { database_id: config.notionDatabaseId },
        properties: buildNotionProperties(structuredData),
      });

      return res.json({
        ok: true,
        data: structuredData,
        notionPageId: notionPage.id,
        notionUrl: notionPage.url,
      });
    } catch (error) {
      console.error("Moji to Notion error:", error);
      return res.status(500).json({
        ok: false,
        message: error.message || "伺服器發生錯誤",
      });
    }
  });

  return app;
}
