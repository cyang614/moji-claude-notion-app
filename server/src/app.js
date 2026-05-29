import express from "express";
import cors from "cors";
import { analyzeMojiTextWithClaude, generateQuizWithClaude } from "./claudeService.js";
import { validateVocabData } from "./claudeJson.js";
import { DEFAULT_PROPERTY_NAMES, buildNotionPageChildren, buildNotionProperties, buildReviewHistoryBlocks } from "./notionMapper.js";

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

export async function queryAllNotionDataSourcePages({ notion, notionDatabaseId, notionDataSourceId, payload }) {
  const results = [];
  let nextCursor;
  let lastResponse = { results: [], has_more: false, next_cursor: null };

  do {
    const pagePayload = nextCursor ? { ...payload, start_cursor: nextCursor } : { ...payload };
    lastResponse = await queryNotionDataSource({
      notion,
      notionDatabaseId,
      notionDataSourceId,
      payload: pagePayload,
    });
    results.push(...(lastResponse.results || []));
    nextCursor = lastResponse.has_more ? lastResponse.next_cursor : null;
  } while (nextCursor);

  return {
    ...lastResponse,
    results,
    has_more: false,
    next_cursor: null,
  };
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

function pageNumber(page, propertyName) {
  const value = page?.properties?.[propertyName]?.number;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
    item.currentInterval = pageNumber(page, DEFAULT_PROPERTY_NAMES.current_interval) ?? estimateCurrentInterval(jlptLevel);
    const reviewCount = pageNumber(page, DEFAULT_PROPERTY_NAMES.review_count);
    const lapseCount = pageNumber(page, DEFAULT_PROPERTY_NAMES.lapse_count);
    const lastReviewed = pageDateStart(page, DEFAULT_PROPERTY_NAMES.last_reviewed);
    const lastReviewResult = pageSelectName(page, DEFAULT_PROPERTY_NAMES.last_review_result);
    if (reviewCount !== null) item.reviewCount = reviewCount;
    if (lapseCount !== null) item.lapseCount = lapseCount;
    if (lastReviewed) item.lastReviewed = lastReviewed;
    if (lastReviewResult) item.lastReviewResult = lastReviewResult;
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

function sumNumberProperties(pages, propertyName) {
  return pages.reduce((sum, page) => sum + (pageNumber(page, propertyName) ?? 0), 0);
}

function averageDueIntervals(pages) {
  if (pages.length === 0) return 0;
  const total = pages.reduce((sum, page) => {
    const jlptLevel = pageSelectName(page, "JLPT 等級") || "Unknown";
    return sum + (pageNumber(page, DEFAULT_PROPERTY_NAMES.current_interval) ?? estimateCurrentInterval(jlptLevel));
  }, 0);
  return Math.round(total / pages.length);
}

function sortByNextReviewDescending(pages) {
  return pages.slice().sort((a, b) => pageDateStart(b, "下次複習日").localeCompare(pageDateStart(a, "下次複習日")));
}

async function resolveQueryContext({ notion, notionDatabaseId, notionDataSourceId }) {
  return typeof notion.dataSources?.query === "function"
    ? await resolveNotionDataSourceId({ notion, notionDatabaseId, notionDataSourceId })
    : notionDataSourceId;
}

async function queryAllVocabularyPages({ notion, notionDatabaseId, notionDataSourceId }) {
  const resolvedDataSourceId = await resolveQueryContext({ notion, notionDatabaseId, notionDataSourceId });
  return queryAllNotionDataSourcePages({
    notion,
    notionDatabaseId,
    notionDataSourceId: resolvedDataSourceId,
    payload: {
      sorts: [{ property: "下次複習日", direction: "descending" }],
      page_size: 100,
    },
  });
}

export async function buildDashboardStats({ notion, notionDatabaseId, notionDataSourceId, today = new Date().toISOString().slice(0, 10) }) {
  const resolvedDataSourceId = await resolveQueryContext({ notion, notionDatabaseId, notionDataSourceId });

  const query = (payload) => queryNotionDataSource({
    notion,
    notionDatabaseId,
    notionDataSourceId: resolvedDataSourceId,
    payload,
  });

  const allVocabularyQuery = queryAllNotionDataSourcePages({
    notion,
    notionDatabaseId,
    notionDataSourceId: resolvedDataSourceId,
    payload: {
      sorts: [{ property: "下次複習日", direction: "descending" }],
      page_size: 100,
    },
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
    srs: {
      status: countBySelect(allPages, DEFAULT_PROPERTY_NAMES.review_status, ["New", "Reviewing", "Archived"]),
      dueTodayCount: duePages.length,
      averageInterval: averageDueIntervals(duePages),
      totalReviews: sumNumberProperties(allPages, DEFAULT_PROPERTY_NAMES.review_count),
      totalLapses: sumNumberProperties(allPages, DEFAULT_PROPERTY_NAMES.lapse_count),
    },
    dueToday: duePages.map((page) => mapDashboardPage(page, false)),
    recentlyAdded: recentlyAddedPages.map((page) => mapDashboardPage(page, true)),
  };
}

export async function buildWeaknessReport({ notion, notionDatabaseId, notionDataSourceId }) {
  const allResult = await queryAllVocabularyPages({ notion, notionDatabaseId, notionDataSourceId });
  const pages = allResult.results || [];
  const reviewedPages = pages.filter((page) => (pageNumber(page, DEFAULT_PROPERTY_NAMES.review_count) ?? 0) > 0);
  const totalLapses = sumNumberProperties(pages, DEFAULT_PROPERTY_NAMES.lapse_count);
  const weakItems = pages
    .map((page) => {
      const lapseCount = pageNumber(page, DEFAULT_PROPERTY_NAMES.lapse_count) ?? 0;
      const reviewCount = pageNumber(page, DEFAULT_PROPERTY_NAMES.review_count) ?? 0;
      return {
        ...mapDashboardPage(page, false),
        reviewCount,
        lapseCount,
        riskLevel: lapseCount >= 2 ? "high" : "medium",
        suggestedAction: lapseCount >= 2
          ? "加入今日任務並用 Claude 小測驗重新檢查語感"
          : "下次複習時先朗讀例句再作答",
      };
    })
    .filter((item) => item.lapseCount > 0)
    .sort((a, b) => b.lapseCount - a.lapseCount || b.reviewCount - a.reviewCount)
    .slice(0, 10);

  return {
    ok: true,
    summary: {
      highRiskCount: weakItems.filter((item) => item.riskLevel === "high").length,
      totalLapses,
      averageLapsesPerReviewedItem: reviewedPages.length ? Math.round((totalLapses / reviewedPages.length) * 10) / 10 : 0,
    },
    recommendations: [
      `先處理生疏次數最高的 ${weakItems.length} 個單字，再做 Claude 小測驗確認是否真正理解。`,
      "Again/生疏 的單字會回到 3 天間隔；若連續生疏，建議重寫例句或補記憶法。",
    ],
    items: weakItems,
  };
}

function uniqueTaskItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.notionPageId || item.vocab;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function buildTodayTasks({ notion, notionDatabaseId, notionDataSourceId, today = new Date().toISOString().slice(0, 10) }) {
  const [stats, weaknessReport] = await Promise.all([
    buildDashboardStats({ notion, notionDatabaseId, notionDataSourceId, today }),
    buildWeaknessReport({ notion, notionDatabaseId, notionDataSourceId }),
  ]);
  const dueItems = stats.dueToday || [];
  const weakItems = weaknessReport.items || [];
  const quizItems = uniqueTaskItems([...dueItems, ...weakItems]).slice(0, 5);

  return {
    ok: true,
    today,
    summary: {
      dueReviewCount: dueItems.length,
      weakItemCount: weakItems.length,
      suggestedQuizCount: quizItems.length,
    },
    tasks: [
      {
        id: "review-due",
        type: "review",
        title: "完成今日待複習",
        description: "先完成到期的 New / Reviewing 卡片，維持每日使用節奏。",
        priority: "high",
        count: dueItems.length,
        items: dueItems,
      },
      {
        id: "weakness-focus",
        type: "weakness",
        title: "優先處理生疏單字",
        description: "把 Again 次數高的單字放在今天前段，避免錯題累積。",
        priority: "medium",
        count: weakItems.length,
        items: weakItems,
      },
      {
        id: "claude-quiz",
        type: "quiz",
        title: "Claude 小測驗",
        description: "用今天到期或生疏單字產生一題語感/例句理解測驗。",
        priority: "medium",
        count: quizItems.length,
        items: quizItems,
      },
    ],
  };
}

const EXPECTED_NOTION_SCHEMA = {
  [DEFAULT_PROPERTY_NAMES.vocab]: "title",
  [DEFAULT_PROPERTY_NAMES.kana]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.pos]: "select",
  [DEFAULT_PROPERTY_NAMES.meaning]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.grammar]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.example_jp]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.example_zh]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.notes]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.jlpt_level]: "select",
  [DEFAULT_PROPERTY_NAMES.difficulty]: "select",
  [DEFAULT_PROPERTY_NAMES.tags]: "multi_select",
  [DEFAULT_PROPERTY_NAMES.collocations]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.nuance]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.common_mistakes]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.memory_hook]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.review_status]: "select",
  [DEFAULT_PROPERTY_NAMES.next_review]: "date",
  [DEFAULT_PROPERTY_NAMES.current_interval]: "number",
  [DEFAULT_PROPERTY_NAMES.review_count]: "number",
  [DEFAULT_PROPERTY_NAMES.lapse_count]: "number",
  [DEFAULT_PROPERTY_NAMES.last_reviewed]: "date",
  [DEFAULT_PROPERTY_NAMES.last_review_result]: "select",
  [DEFAULT_PROPERTY_NAMES.raw_moji_text]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.conjugations]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.related_words]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.synonyms]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.antonyms]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.all_examples]: "rich_text",
  [DEFAULT_PROPERTY_NAMES.kanji_readings]: "rich_text",
};

function requireNotionConfig({ notion, config }) {
  if (!notion) return "後端缺少 NOTION_API_KEY";
  if (!config.notionDatabaseId) return "後端缺少 NOTION_DATABASE_ID";
  return "";
}

async function createVocabularyPageFromData({ notion, config, data }) {
  const structuredData = validateVocabData(data);
  const duplicateResult = await queryVocabularyDuplicate({
    notion,
    notionDatabaseId: config.notionDatabaseId,
    notionDataSourceId: config.notionDataSourceId,
    vocab: structuredData.vocab,
  });

  const existingPage = duplicateResult.results?.[0];
  if (existingPage) {
    return {
      ok: false,
      duplicate: true,
      message: "此單字已存在於 Notion",
      data: structuredData,
      notionUrl: existingPage.url || "",
    };
  }

  const notionPage = await notion.pages.create({
    parent: { database_id: config.notionDatabaseId },
    properties: buildNotionProperties(structuredData),
    children: buildNotionPageChildren(structuredData),
  });

  return {
    ok: true,
    data: structuredData,
    notionPageId: notionPage.id,
    notionUrl: notionPage.url,
  };
}

async function analyzeThenSaveMojiText({ anthropic, notion, config, mojiText }) {
  const structuredData = await analyzeMojiTextWithClaude({
    anthropic,
    mojiText: mojiText.trim(),
    model: config.claudeModel,
  });
  return createVocabularyPageFromData({ notion, config, data: structuredData });
}

export async function checkNotionSchemaHealth({ notion, notionDatabaseId }) {
  if (!notion?.databases?.retrieve) {
    throw new Error("目前的 Notion SDK 不支援 databases.retrieve，無法檢查 schema");
  }

  const database = await notion.databases.retrieve({ database_id: notionDatabaseId });
  const properties = database.properties || {};
  const entries = Object.entries(EXPECTED_NOTION_SCHEMA);
  const missing = [];
  const typeMismatches = [];

  for (const [property, expectedType] of entries) {
    const actualType = properties[property]?.type;
    if (!actualType) {
      missing.push({ property, expectedType });
    } else if (actualType !== expectedType) {
      typeMismatches.push({ property, expectedType, actualType });
    }
  }

  return {
    ok: true,
    healthy: missing.length === 0 && typeMismatches.length === 0,
    checked: entries.length,
    missing,
    typeMismatches,
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

  app.get("/api/today-tasks", async (_req, res) => {
    try {
      const configError = requireNotionConfig({ notion, config });
      if (configError) return res.status(500).json({ ok: false, message: configError });

      const todayTasks = await buildTodayTasks({
        notion,
        notionDatabaseId: config.notionDatabaseId,
        notionDataSourceId: config.notionDataSourceId,
      });
      return res.json(todayTasks);
    } catch (error) {
      console.error("Today tasks error:", error);
      return res.status(500).json({ ok: false, message: error.message || "今日任務讀取失敗" });
    }
  });

  app.get("/api/weakness-report", async (_req, res) => {
    try {
      const configError = requireNotionConfig({ notion, config });
      if (configError) return res.status(500).json({ ok: false, message: configError });

      const report = await buildWeaknessReport({
        notion,
        notionDatabaseId: config.notionDatabaseId,
        notionDataSourceId: config.notionDataSourceId,
      });
      return res.json(report);
    } catch (error) {
      console.error("Weakness report error:", error);
      return res.status(500).json({ ok: false, message: error.message || "錯題本 / 生疏分析讀取失敗" });
    }
  });

  app.post("/api/quiz/generate", async (req, res) => {
    try {
      if (!anthropic) {
        return res.status(500).json({ ok: false, message: "後端缺少 ANTHROPIC_API_KEY" });
      }

      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ ok: false, message: "請提供 items 陣列" });
      }

      const quiz = await generateQuizWithClaude({
        anthropic,
        items,
        model: config.claudeModel,
      });
      return res.json({ ok: true, quiz });
    } catch (error) {
      console.error("Claude quiz error:", error);
      return res.status(500).json({ ok: false, message: error.message || "Claude 小測驗產生失敗" });
    }
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

      const today = new Date().toISOString().slice(0, 10);
      const currentPage = typeof notion.pages?.retrieve === "function"
        ? await notion.pages.retrieve({ page_id: notionPageId })
        : null;
      const previousInterval = pageNumber(currentPage, DEFAULT_PROPERTY_NAMES.current_interval) ?? currentInterval;
      const previousReviewCount = pageNumber(currentPage, DEFAULT_PROPERTY_NAMES.review_count) ?? 0;
      const previousLapseCount = pageNumber(currentPage, DEFAULT_PROPERTY_NAMES.lapse_count) ?? 0;
      const review = calcNextReview(result, previousInterval, today);
      const nextReviewCount = previousReviewCount + 1;
      const nextLapseCount = previousLapseCount + (review.result === "again" ? 1 : 0);

      await notion.pages.update({
        page_id: notionPageId,
        properties: {
          [DEFAULT_PROPERTY_NAMES.review_status]: { select: { name: review.newStatus } },
          [DEFAULT_PROPERTY_NAMES.next_review]: { date: { start: review.nextReviewDate } },
          [DEFAULT_PROPERTY_NAMES.current_interval]: { number: review.newInterval },
          [DEFAULT_PROPERTY_NAMES.review_count]: { number: nextReviewCount },
          [DEFAULT_PROPERTY_NAMES.lapse_count]: { number: nextLapseCount },
          [DEFAULT_PROPERTY_NAMES.last_reviewed]: { date: { start: today } },
          [DEFAULT_PROPERTY_NAMES.last_review_result]: { select: { name: review.resultLabel } },
        },
      });

      if (typeof notion.blocks?.children?.append === "function") {
        await notion.blocks.children.append({
          block_id: notionPageId,
          children: buildReviewHistoryBlocks({
            reviewedAt: today,
            resultLabel: review.resultLabel,
            previousInterval: Number.isFinite(Number(previousInterval)) ? Number(previousInterval) : 3,
            newInterval: review.newInterval,
            reviewCount: nextReviewCount,
            nextReviewDate: review.nextReviewDate,
          }),
        });
      }

      return res.json({
        ok: true,
        ...review,
        reviewCount: nextReviewCount,
        lapseCount: nextLapseCount,
        lastReviewed: today,
      });
    } catch (error) {
      console.error("Review update error:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "複習結果更新失敗",
      });
    }
  });

  app.get("/api/notion-schema-health", async (_req, res) => {
    try {
      const configError = requireNotionConfig({ notion, config });
      if (configError) return res.status(500).json({ ok: false, message: configError });

      const health = await checkNotionSchemaHealth({
        notion,
        notionDatabaseId: config.notionDatabaseId,
      });
      return res.json(health);
    } catch (error) {
      console.error("Notion schema health error:", error);
      return res.status(500).json({ ok: false, message: error.message || "Notion schema 檢查失敗" });
    }
  });

  app.post("/api/moji-preview", async (req, res) => {
    try {
      const { mojiText } = req.body || {};
      if (!mojiText || typeof mojiText !== "string" || !mojiText.trim()) {
        return res.status(400).json({ ok: false, message: "請提供 mojiText 字串" });
      }
      if (!anthropic) {
        return res.status(500).json({ ok: false, message: "後端缺少 ANTHROPIC_API_KEY" });
      }

      const structuredData = await analyzeMojiTextWithClaude({
        anthropic,
        mojiText: mojiText.trim(),
        model: config.claudeModel,
      });

      return res.json({ ok: true, mode: "preview", data: structuredData });
    } catch (error) {
      console.error("Moji preview error:", error);
      return res.status(500).json({ ok: false, message: error.message || "Claude 預覽分析失敗" });
    }
  });

  app.post("/api/vocab-to-notion", async (req, res) => {
    try {
      const configError = requireNotionConfig({ notion, config });
      if (configError) return res.status(500).json({ ok: false, message: configError });

      const { data } = req.body || {};
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return res.status(400).json({ ok: false, message: "請提供 data 物件" });
      }

      const result = await createVocabularyPageFromData({ notion, config, data });
      if (result.duplicate) {
        const { data: _data, ...duplicatePayload } = result;
        return res.status(409).json(duplicatePayload);
      }
      return res.json(result);
    } catch (error) {
      console.error("Vocab to Notion error:", error);
      return res.status(500).json({ ok: false, message: error.message || "儲存到 Notion 失敗" });
    }
  });

  app.post("/api/batch-moji-to-notion", async (req, res) => {
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ ok: false, message: "請提供 entries 陣列" });
    }
    if (!anthropic) {
      return res.status(500).json({ ok: false, message: "後端缺少 ANTHROPIC_API_KEY" });
    }
    const configError = requireNotionConfig({ notion, config });
    if (configError) return res.status(500).json({ ok: false, message: configError });

    const items = [];
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "string" || !entry.trim()) {
        items.push({ index, status: "failed", message: "空白項目已略過" });
        continue;
      }

      try {
        const result = await analyzeThenSaveMojiText({ anthropic, notion, config, mojiText: entry });
        if (result.duplicate) {
          items.push({ index, status: "duplicate", vocab: result.data?.vocab || "", message: result.message, notionUrl: result.notionUrl });
        } else {
          items.push({ index, status: "created", vocab: result.data.vocab, data: result.data, notionPageId: result.notionPageId, notionUrl: result.notionUrl });
        }
      } catch (error) {
        items.push({ index, status: "failed", message: error.message || "匯入失敗" });
      }
    }

    const summary = items.reduce((counts, item) => {
      counts[item.status] += 1;
      return counts;
    }, { total: entries.length, created: 0, duplicate: 0, failed: 0 });

    return res.json({ ok: true, summary, items });
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
