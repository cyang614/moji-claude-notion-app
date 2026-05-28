import express from "express";
import cors from "cors";
import { analyzeMojiTextWithClaude } from "./claudeService.js";
import { buildNotionPageChildren, buildNotionProperties } from "./notionMapper.js";

export async function resolveNotionDataSourceId({ notion, notionDatabaseId, notionDataSourceId }) {
  if (notionDataSourceId) return notionDataSourceId;

  if (typeof notion.databases?.retrieve === "function") {
    const database = await notion.databases.retrieve({ database_id: notionDatabaseId });
    const resolvedDataSourceId = database.data_sources?.[0]?.id;
    if (resolvedDataSourceId) return resolvedDataSourceId;
  }

  return notionDatabaseId;
}

export async function queryVocabularyDuplicate({ notion, notionDatabaseId, notionDataSourceId, vocab }) {
  const filter = { property: "單字", title: { equals: vocab } };

  if (typeof notion.dataSources?.query === "function") {
    const dataSourceId = await resolveNotionDataSourceId({ notion, notionDatabaseId, notionDataSourceId });
    return notion.dataSources.query({
      data_source_id: dataSourceId,
      filter,
      page_size: 1,
    });
  }

  if (typeof notion.databases?.query === "function") {
    return notion.databases.query({
      database_id: notionDatabaseId,
      filter,
      page_size: 1,
    });
  }

  throw new Error("目前的 Notion SDK 不支援 database/data source query，請更新 @notionhq/client 或確認 SDK 版本");
}

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
      hasNotionDataSourceId: Boolean(config.notionDataSourceId),
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

      const duplicateResult = await queryVocabularyDuplicate({
        notion,
        notionDatabaseId: config.notionDatabaseId,
        notionDataSourceId: config.notionDataSourceId,
        vocab: structuredData.vocab,
      });

      const existingPage = duplicateResult.results?.[0];
      if (existingPage) {
        return res.status(409).json({
          ok: false,
          duplicate: true,
          message: "此單字已存在於 Notion",
          notionUrl: existingPage.url || "",
        });
      }

      const notionPage = await notion.pages.create({
        parent: { database_id: config.notionDatabaseId },
        properties: buildNotionProperties(structuredData),
        children: buildNotionPageChildren(structuredData),
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
