import express from "express";
import cors from "cors";
import { analyzeMojiTextWithClaude } from "./claudeService.js";
import { DEFAULT_PROPERTY_NAMES, buildNotionPageChildren, buildNotionProperties } from "./notionMapper.js";

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

const REVIEW_RESULTS = {
  again: { label: "生疏", multiplier: 0, status: "New" },
  hard: { label: "困難", multiplier: 1.2, status: "Reviewing" },
  good: { label: "一般", multiplier: 2.5, status: "Reviewing" },
  easy: { label: "簡單", multiplier: 4, status: "Reviewing" },
};
const LEGACY_REVIEW_ALIASES = {
  forgotten: "again",
  remembered: "good",
};

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calcNextReview(result, currentInterval = 3, today = new Date().toISOString().slice(0, 10)) {
  const normalizedResult = LEGACY_REVIEW_ALIASES[result] || result;
  const rule = REVIEW_RESULTS[normalizedResult];
  if (!rule) {
    throw new Error("result 必須是 again、hard、good 或 easy");
  }

  const interval = Number.isFinite(Number(currentInterval)) && Number(currentInterval) > 0
    ? Number(currentInterval)
    : 3;
  const newInterval = normalizedResult === "again"
    ? 3
    : Math.min(Math.max(Math.round(interval * rule.multiplier), 1), 90);

  return {
    result: normalizedResult,
    resultLabel: rule.label,
    newInterval,
    newStatus: rule.status,
    nextReviewDate: addDays(today, newInterval),
  };
}

function estimateCurrentInterval(jlptLevel) {
  if (["N5", "N4"].includes(jlptLevel)) return 3;
  if (jlptLevel === "N3") return 5;
  return 7;
}

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
  const jlptLevel = pageSelectName(page, "JLPT 等級") || "Unknown";
  const item = {
    vocab: pageTextProperty(page, "單字"),
    kana: pageTextProperty(page, "讀音"),
    jlpt_level: jlptLevel,
    notionUrl: page.url || "",
  };

  if (includeDifficulty) {
    item.difficulty = pageSelectName(page, "難度") || "";
  } else {
    item.next_review = pageDateStart(page, "下次複習日");
    item.notionPageId = page.id || "";
    item.currentInterval = estimateCurrentInterval(jlptLevel);
    item.meaning = pageTextProperty(page, "中文意思");
    item.example_jp = pageTextProperty(page, "核心例句（日文）");
    item.example_zh = pageTextProperty(page, "例句翻譯");
    item.notes = pageTextProperty(page, "學習筆記");
  }

  return item;
}

function getSettledResults(settledResult, fallback = []) {
  if (settledResult.status === "fulfilled") return settledResult.value.results || fallback;
  console.warn("Dashboard Notion query failed:", settledResult.reason?.message || settledResult.reason);
  return fallback;
}

function countBySelect(pages, propertyName, keys) {
  return pages.reduce((counts, page) => {
    const key = pageSelectName(page, propertyName) || (propertyName === "JLPT 等級" ? "Unknown" : "");
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    return counts;
  }, Object.fromEntries(keys.map((key) => [key, 0])));
}

function sortByNextReviewDescending(pages) {
  return pages.slice().sort((a, b) => pageDateStart(b, "下次複習日").localeCompare(pageDateStart(a, "下次複習日")));
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

  const allVocabularyQuery = query({
    sorts: [{ property: "下次複習日", direction: "descending" }],
    page_size: 100,
  });

  const dueTodayQuery = query({
    filter: {
      and: [
        { property: "下次複習日", date: { on_or_before: today } },
        {
          or: [
            { property: "複習狀態", select: { equals: "New" } },
            { property: "複習狀態", select: { equals: "Reviewing" } },
          ],
        },
      ],
    },
    page_size: 20,
  });

  const settled = await Promise.allSettled([allVocabularyQuery, dueTodayQuery]);
  const allPages = getSettledResults(settled[0]);
  const duePages = getSettledResults(settled[1]);
  const recentlyAddedPages = sortByNextReviewDescending(allPages).slice(0, 10);

  return {
    ok: true,
    total: allPages.length,
    jlpt: countBySelect(allPages, "JLPT 等級", JLPT_LEVELS),
    difficulty: countBySelect(allPages, "難度", DIFFICULTY_LEVELS),
    dueToday: duePages.map((page) => mapDashboardPage(page, false)),
    recentlyAdded: recentlyAddedPages.map((page) => mapDashboardPage(page, true)),
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

  app.patch("/api/review", async (req, res) => {
    try {
      if (!notion) {
        return res.status(500).json({ ok: false, error: "後端缺少 NOTION_API_KEY" });
      }

      const { notionPageId, result, currentInterval } = req.body || {};
      if (!notionPageId) {
        return res.status(500).json({ ok: false, error: "請提供 notionPageId" });
      }

      const review = calcNextReview(result, currentInterval);
      await notion.pages.update({
        page_id: notionPageId,
        properties: {
          [DEFAULT_PROPERTY_NAMES.review_status]: { select: { name: review.newStatus } },
          [DEFAULT_PROPERTY_NAMES.next_review]: { date: { start: review.nextReviewDate } },
        },
      });

      return res.json({ ok: true, ...review });
    } catch (error) {
      console.error("Review update error:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "複習結果更新失敗",
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
