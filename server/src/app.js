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

export async function queryNotionDataSource({ notion, notionDatabaseId, notionDataSourceId, payload }) {
  if (typeof notion.dataSources?.query === "function") {
    const dataSourceId = await resolveNotionDataSourceId({ notion, notionDatabaseId, notionDataSourceId });
    return notion.dataSources.query({
      data_source_id: dataSourceId,
      ...payload,
    });
  }

  if (typeof notion.databases?.query === "function") {
    return notion.databases.query({
      database_id: notionDatabaseId,
      ...payload,
    });
  }

  throw new Error("目前的 Notion SDK 不支援 database/data source query，請更新 @notionhq/client 或確認 SDK 版本");
}

export async function queryVocabularyDuplicate({ notion, notionDatabaseId, notionDataSourceId, vocab }) {
  return queryNotionDataSource({
    notion,
    notionDatabaseId,
    notionDataSourceId,
    payload: {
      filter: { property: "單字", title: { equals: vocab } },
      page_size: 1,
    },
  });
}

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1", "Unknown"];
const DIFFICULTY_LEVELS = ["1", "2", "3", "4", "5"];

function firstPlainText(items = []) {
  return items.map((item) => item.plain_text || item.text?.content || "").join("").trim();
}

function pageTextProperty(page, propertyName) {
  const property = page.properties?.[propertyName];
  if (!property) return "";
  if (property.title) return firstPlainText(property.title);
  if (property.rich_text) return firstPlainText(property.rich_text);
  return "";
}

function pageSelectName(page, propertyName) {
  return page.properties?.[propertyName]?.select?.name || "";
}

function pageDateStart(page, propertyName) {
  return page.properties?.[propertyName]?.date?.start || "";
}

function mapDashboardPage(page, includeDifficulty = false) {
  const item = {
    vocab: pageTextProperty(page, "單字"),
    kana: pageTextProperty(page, "讀音"),
    jlpt_level: pageSelectName(page, "JLPT 等級") || "Unknown",
    notionUrl: page.url || "",
  };

  if (includeDifficulty) {
    item.difficulty = pageSelectName(page, "難度") || "";
  } else {
    item.next_review = pageDateStart(page, "下次複習日");
  }

  return item;
}

function getSettledResults(settledResult, fallback = []) {
  if (settledResult.status === "fulfilled") return settledResult.value.results || fallback;
  console.warn("Dashboard Notion query failed:", settledResult.reason?.message || settledResult.reason);
  return fallback;
}

export async function buildDashboardStats({ notion, notionDatabaseId, notionDataSourceId, today = new Date().toISOString().slice(0, 10) }) {
  const resolvedDataSourceId = typeof notion.dataSources?.query === "function"
    ? await resolveNotionDataSourceId({ notion, notionDatabaseId, notionDataSourceId })
    : notionDataSourceId;

  const query = (payload) => queryNotionDataSource({
    notion,
    notionDatabaseId,
    notionDataSourceId: resolvedDataSourceId,
    payload,
  });

  const jlptQueries = JLPT_LEVELS.map((level) => query({
    filter: { property: "JLPT 等級", select: { equals: level } },
    page_size: 100,
  }));

  const difficultyQueries = DIFFICULTY_LEVELS.map((level) => query({
    filter: { property: "難度", select: { equals: level } },
    page_size: 100,
  }));

  const dueTodayQuery = query({
    filter: {
      and: [
        { property: "下次複習日", date: { on_or_before: today } },
        { property: "複習狀態", select: { equals: "New" } },
      ],
    },
    page_size: 20,
  });

  const recentlyAddedQuery = query({
    sorts: [{ property: "下次複習日", direction: "descending" }],
    page_size: 10,
  });

  const totalQuery = query({ page_size: 100 });

  const settled = await Promise.allSettled([
    ...jlptQueries,
    ...difficultyQueries,
    dueTodayQuery,
    recentlyAddedQuery,
    totalQuery,
  ]);

  const jlpt = Object.fromEntries(JLPT_LEVELS.map((level, index) => [
    level,
    getSettledResults(settled[index]).length,
  ]));

  const difficultyOffset = JLPT_LEVELS.length;
  const difficulty = Object.fromEntries(DIFFICULTY_LEVELS.map((level, index) => [
    level,
    getSettledResults(settled[difficultyOffset + index]).length,
  ]));

  const dueTodayIndex = difficultyOffset + DIFFICULTY_LEVELS.length;
  const recentlyAddedIndex = dueTodayIndex + 1;
  const totalIndex = recentlyAddedIndex + 1;

  return {
    ok: true,
    total: getSettledResults(settled[totalIndex]).length,
    jlpt,
    difficulty,
    dueToday: getSettledResults(settled[dueTodayIndex]).map((page) => mapDashboardPage(page, false)),
    recentlyAdded: getSettledResults(settled[recentlyAddedIndex]).map((page) => mapDashboardPage(page, true)),
  };
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

  app.get("/api/dashboard-stats", async (_req, res) => {
    try {
      if (!notion) {
        return res.status(500).json({ ok: false, message: "後端缺少 NOTION_API_KEY" });
      }

      if (!config.notionDatabaseId) {
        return res.status(500).json({ ok: false, message: "後端缺少 NOTION_DATABASE_ID" });
      }

      const stats = await buildDashboardStats({
        notion,
        notionDatabaseId: config.notionDatabaseId,
        notionDataSourceId: config.notionDataSourceId,
      });

      return res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({
        ok: false,
        message: error.message || "儀表板統計讀取失敗",
      });
    }
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
