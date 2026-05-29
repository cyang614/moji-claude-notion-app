import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { calcNextReview, createApp } from "../src/app.js";

function notionPage({
  vocab,
  kana = "",
  jlpt = "Unknown",
  difficulty = "3",
  nextReview = null,
  reviewStatus = "New",
  currentInterval = null,
  reviewCount = null,
  lapseCount = null,
  lastReviewed = null,
  lastReviewResult = null,
  meaning = "",
  exampleJp = "",
  exampleZh = "",
  notes = "",
  url = "https://notion.so/page",
}) {
  return {
    id: `${vocab}-id`,
    url,
    properties: {
      單字: { title: [{ plain_text: vocab, text: { content: vocab } }] },
      讀音: { rich_text: kana ? [{ plain_text: kana, text: { content: kana } }] : [] },
      "JLPT 等級": { select: jlpt ? { name: jlpt } : null },
      難度: { select: difficulty ? { name: difficulty } : null },
      複習狀態: { select: reviewStatus ? { name: reviewStatus } : null },
      下次複習日: { date: nextReview ? { start: nextReview } : null },
      目前間隔: { number: currentInterval },
      複習次數: { number: reviewCount },
      生疏次數: { number: lapseCount },
      上次複習日: { date: lastReviewed ? { start: lastReviewed } : null },
      最近複習結果: { select: lastReviewResult ? { name: lastReviewResult } : null },
      中文意思: { rich_text: meaning ? [{ plain_text: meaning, text: { content: meaning } }] : [] },
      "核心例句（日文）": { rich_text: exampleJp ? [{ plain_text: exampleJp, text: { content: exampleJp } }] : [] },
      例句翻譯: { rich_text: exampleZh ? [{ plain_text: exampleZh, text: { content: exampleZh } }] : [] },
      學習筆記: { rich_text: notes ? [{ plain_text: notes, text: { content: notes } }] : [] },
    },
  };
}

const claudeV3Response = {
  vocab: "退く",
  kana: "どく",
  pos: "自動詞・五段",
  meaning: "讓開；躲開；退讓；退出；離開",
  grammar: "ます形：退きます；て形：退いて。自動詞，常用於請對方讓開位置。",
  example_jp: "ちょっとどいてくれ。",
  example_zh: "請讓開一下。",
  notes: "「どく」多用於讓出空間；「しりぞく」偏向退出職位、戰線或位置。",
  jlpt_level: "N3",
  difficulty: "3",
  tags: ["日常", "口語", "移動", "自動詞", "N3"],
  collocations: "ちょっとどいて、そこをどく、席をどく、王位を退く、選挙戦から退く",
  nuance: "「どく」口語感強，常表示從某處讓開。",
  common_mistakes: "不要把簡體的「让开」保留原樣，台灣繁體應寫「讓開」。",
  memory_hook: "看到「どいて」可聯想到請人挪開、讓位。",
  review_status: "New",
  next_review: "2026-06-01",
  raw_moji_text: "退く②⓪\nどく\ndoku\n自動·五段\n簡明釋義\n让开；躲开；退让",
  conjugations: "ます形：退きます；て形：退いて",
  related_words: "他動詞：退かす（どかす）；多音詞：退く（しりぞく・のく・ひく・そく・しぞく）",
  synonyms: "引っ込む、引き下がる、引き上げる、下がる、引き揚げる",
  antonyms: "進む",
  all_examples: "1. ちょっとどいてくれ。— 請讓開一下。\n2. 私は王位を退き、息子に託します。— 我將退位並交託給兒子。",
  kanji_readings: "退く（どく／しりぞく）、退かす（どかす）、王位（おうい）、選挙戦（せんきょせん）",
};

function createAnthropicMock(response = claudeV3Response) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(response),
          },
        ],
      }),
    },
  };
}

function createNotionMock(queryResponse = { results: [] }, pageResponse = notionPage({ vocab: "退く", currentInterval: 3, reviewCount: 5, lapseCount: 2 })) {
  return {
    databases: {
      query: vi.fn().mockResolvedValue(queryResponse),
    },
    pages: {
      retrieve: vi.fn().mockResolvedValue(pageResponse),
      create: vi.fn().mockResolvedValue({
        id: "notion-page-id",
        url: "https://notion.so/notion-page-id",
      }),
      update: vi.fn().mockResolvedValue({ id: "updated-page-id" }),
    },
    blocks: {
      children: {
        append: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

function createNotionV5Mock(queryResponse = { results: [] }) {
  return {
    databases: {
      retrieve: vi.fn().mockResolvedValue({
        id: "database-id",
        object: "database",
        data_sources: [{ id: "data-source-id", name: "學習筆記" }],
      }),
      update: vi.fn(),
    },
    dataSources: {
      query: vi.fn().mockResolvedValue(queryResponse),
    },
    pages: {
      retrieve: vi.fn().mockResolvedValue(notionPage({ vocab: "退く", currentInterval: 3, reviewCount: 5, lapseCount: 2 })),
      create: vi.fn().mockResolvedValue({
        id: "notion-page-id",
        url: "https://notion.so/notion-page-id",
      }),
      update: vi.fn().mockResolvedValue({ id: "updated-page-id" }),
    },
    blocks: {
      children: {
        append: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

function createDashboardNotionMock() {
  const pages = [
    notionPage({ vocab: "猫", kana: "ねこ", jlpt: "N5", difficulty: "1", nextReview: "2026-05-27", reviewStatus: "New", url: "https://notion.so/neko" }),
    notionPage({
      vocab: "退く",
      kana: "どく",
      jlpt: "N3",
      difficulty: "3",
      nextReview: "2026-05-26",
      reviewStatus: "Reviewing",
      meaning: "讓開；退讓",
      exampleJp: "ちょっとどいてくれ。",
      exampleZh: "請讓開一下。",
      notes: "口語常用。",
      currentInterval: 9,
      reviewCount: 7,
      lapseCount: 2,
      lastReviewed: "2026-05-20",
      lastReviewResult: "困難",
      url: "https://notion.so/doku",
    }),
    notionPage({ vocab: "概念", kana: "がいねん", jlpt: "N2", difficulty: "4", nextReview: "2026-06-01", reviewStatus: "Reviewing", url: "https://notion.so/gainen" }),
    notionPage({ vocab: "保留", kana: "ほりゅう", jlpt: "N2", difficulty: "2", nextReview: "2026-05-25", reviewStatus: "Archived", url: "https://notion.so/horyu" }),
  ];

  function hasDueFilter(payload) {
    return JSON.stringify(payload.filter || {}).includes("下次複習日");
  }

  return {
    databases: {
      retrieve: vi.fn().mockResolvedValue({
        id: "database-id",
        object: "database",
        data_sources: [{ id: "data-source-id", name: "學習筆記" }],
      }),
    },
    dataSources: {
      query: vi.fn().mockImplementation(async (payload) => {
        if (hasDueFilter(payload)) {
          return { results: pages.filter((page) => ["New", "Reviewing"].includes(page.properties.複習狀態.select?.name) && page.properties.下次複習日.date?.start <= "2026-05-28") };
        }
        return { results: pages };
      }),
    },
    pages: { create: vi.fn() },
  };
}

describe("SRS review mode", () => {
  it("calculates next review dates for Anki-style four choice results", () => {
    expect(calcNextReview("again", 5, "2026-05-28")).toEqual({
      result: "again",
      resultLabel: "生疏",
      newInterval: 3,
      newStatus: "New",
      nextReviewDate: "2026-05-31",
    });

    expect(calcNextReview("hard", 5, "2026-05-28")).toEqual({
      result: "hard",
      resultLabel: "困難",
      newInterval: 6,
      newStatus: "Reviewing",
      nextReviewDate: "2026-06-03",
    });

    expect(calcNextReview("good", 5, "2026-05-28")).toEqual({
      result: "good",
      resultLabel: "一般",
      newInterval: 13,
      newStatus: "Reviewing",
      nextReviewDate: "2026-06-10",
    });

    expect(calcNextReview("easy", 5, "2026-05-28")).toEqual({
      result: "easy",
      resultLabel: "簡單",
      newInterval: 20,
      newStatus: "Reviewing",
      nextReviewDate: "2026-06-17",
    });

    expect(calcNextReview("easy", 30, "2026-05-28").newInterval).toBe(90);
  });

  it("updates Notion review status, SRS interval counters, and appends a review history block", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));

    const notion = createNotionMock({ results: [] }, notionPage({
      vocab: "退く",
      currentInterval: 3,
      reviewCount: 5,
      lapseCount: 2,
    }));
    const app = createApp({
      anthropic: null,
      notion,
      config: { notionDatabaseId: "database-id", claudeModel: "claude-test-model" },
    });

    const res = await request(app)
      .patch("/api/review")
      .send({ notionPageId: "page-123", result: "good" })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      result: "good",
      resultLabel: "一般",
      newInterval: 8,
      newStatus: "Reviewing",
      nextReviewDate: "2026-06-05",
      reviewCount: 6,
      lapseCount: 2,
      lastReviewed: "2026-05-28",
    });
    expect(notion.pages.retrieve).toHaveBeenCalledWith({ page_id: "page-123" });
    expect(notion.pages.update).toHaveBeenCalledWith({
      page_id: "page-123",
      properties: {
        "複習狀態": { select: { name: "Reviewing" } },
        "下次複習日": { date: { start: "2026-06-05" } },
        "目前間隔": { number: 8 },
        "複習次數": { number: 6 },
        "生疏次數": { number: 2 },
        "上次複習日": { date: { start: "2026-05-28" } },
        "最近複習結果": { select: { name: "一般" } },
      },
    });
    expect(notion.blocks.children.append).toHaveBeenCalledWith({
      block_id: "page-123",
      children: [
        expect.objectContaining({
          type: "bulleted_list_item",
        }),
      ],
    });
    expect(JSON.stringify(notion.blocks.children.append.mock.calls[0][0].children)).toContain("間隔 3 → 8 天");

    vi.useRealTimers();
  });

  it("increments lapse count when the review result is again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));

    const notion = createNotionMock({ results: [] }, notionPage({
      vocab: "猫",
      currentInterval: 12,
      reviewCount: 4,
      lapseCount: 1,
    }));
    const app = createApp({
      anthropic: null,
      notion,
      config: { notionDatabaseId: "database-id", claudeModel: "claude-test-model" },
    });

    const res = await request(app)
      .patch("/api/review")
      .send({ notionPageId: "page-456", result: "again" })
      .expect(200);

    expect(res.body).toMatchObject({
      result: "again",
      resultLabel: "生疏",
      newInterval: 3,
      newStatus: "New",
      nextReviewDate: "2026-05-31",
      reviewCount: 5,
      lapseCount: 2,
      lastReviewed: "2026-05-28",
    });
    expect(notion.pages.update.mock.calls[0][0].properties["生疏次數"]).toEqual({ number: 2 });
    expect(notion.pages.update.mock.calls[0][0].properties["最近複習結果"]).toEqual({ select: { name: "生疏" } });

    vi.useRealTimers();
  });
});


describe("GET /api/dashboard-stats", () => {
  it("returns dashboard stats aggregated from Notion vocabulary properties", async () => {
    const notion = createDashboardNotionMock();
    const app = createApp({
      anthropic: null,
      notion,
      config: {
        notionDatabaseId: "database-id",
        claudeModel: "claude-test-model",
        allowedOrigin: "http://localhost:5173",
      },
    });

    const res = await request(app).get("/api/dashboard-stats").expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      total: 4,
      jlpt: { N5: 1, N4: 0, N3: 1, N2: 2, N1: 0, Unknown: 0 },
      difficulty: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 0 },
    });
    expect(res.body.dueToday).toEqual([
      {
        vocab: "猫",
        kana: "ねこ",
        jlpt_level: "N5",
        next_review: "2026-05-27",
        notionPageId: "猫-id",
        notionUrl: "https://notion.so/neko",
        currentInterval: 3,
        meaning: "",
        example_jp: "",
        example_zh: "",
        notes: "",
      },
      {
        vocab: "退く",
        kana: "どく",
        jlpt_level: "N3",
        next_review: "2026-05-26",
        notionPageId: "退く-id",
        notionUrl: "https://notion.so/doku",
        currentInterval: 9,
        reviewCount: 7,
        lapseCount: 2,
        lastReviewed: "2026-05-20",
        lastReviewResult: "困難",
        meaning: "讓開；退讓",
        example_jp: "ちょっとどいてくれ。",
        example_zh: "請讓開一下。",
        notes: "口語常用。",
      },
    ]);
    expect(res.body.recentlyAdded[0]).toEqual({
      vocab: "概念",
      kana: "がいねん",
      jlpt_level: "N2",
      difficulty: "4",
      notionUrl: "https://notion.so/gainen",
    });
    expect(notion.databases.retrieve).toHaveBeenCalledWith({ database_id: "database-id" });
    expect(notion.dataSources.query).toHaveBeenCalledTimes(2);
    expect(notion.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({
      data_source_id: "data-source-id",
      sorts: [{ property: "下次複習日", direction: "descending" }],
      page_size: 100,
    }));
    expect(notion.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({
      data_source_id: "data-source-id",
      page_size: 20,
      filter: {
        and: [
          { property: "下次複習日", date: { on_or_before: expect.any(String) } },
          {
            or: [
              { property: "複習狀態", select: { equals: "New" } },
              { property: "複習狀態", select: { equals: "Reviewing" } },
            ],
          },
        ],
      },
    }));
  });

  it("returns partial dashboard stats when one Notion query fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notion = createDashboardNotionMock();
    notion.dataSources.query.mockImplementationOnce(async () => {
      throw new Error("Notion temporary failure");
    });
    const app = createApp({
      anthropic: null,
      notion,
      config: { notionDatabaseId: "database-id", claudeModel: "claude-test-model" },
    });

    const res = await request(app).get("/api/dashboard-stats").expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.jlpt.N5).toBe(0);
    expect(res.body.dueToday).toEqual(expect.any(Array));
    expect(warnSpy).toHaveBeenCalledWith("Dashboard Notion query failed:", "Notion temporary failure");
  });
});


describe("POST /api/moji-to-notion", () => {
  it("sends Moji text to Claude, checks duplicates, and creates a Notion page with Chinese properties and page body content", async () => {
    const anthropic = createAnthropicMock();
    const notion = createNotionMock();

    const app = createApp({
      anthropic,
      notion,
      config: {
        notionDatabaseId: "database-id",
        claudeModel: "claude-test-model",
        allowedOrigin: "http://localhost:5173",
      },
    });

    const res = await request(app)
      .post("/api/moji-to-notion")
      .send({ mojiText: "退く②⓪\nどく\n让开；躲开；退让" })
      .expect(200);

    const notionPayload = notion.pages.create.mock.calls[0][0];

    expect(res.body.ok).toBe(true);
    expect(res.body.data.vocab).toBe("退く");
    expect(res.body.data.meaning).toContain("讓開");
    expect(res.body.data.all_examples).toContain("退位");
    expect(res.body.notionPageId).toBe("notion-page-id");
    expect(anthropic.messages.create).toHaveBeenCalledOnce();
    expect(notion.databases.query).toHaveBeenCalledWith({
      database_id: "database-id",
      filter: { property: "單字", title: { equals: "退く" } },
      page_size: 1,
    });
    expect(notion.pages.create).toHaveBeenCalledOnce();
    expect(notionPayload.properties["JLPT 等級"].select.name).toBe("N3");
    expect(notionPayload.properties["漢字假名對照"].rich_text[0].text.content).toContain("王位（おうい）");
    expect(JSON.stringify(notionPayload.children)).toContain("Claude 整理內容");
    expect(JSON.stringify(notionPayload.children)).toContain("選挙戦（せんきょせん）");
  });

  it("uses Notion SDK v5 dataSources.query when databases.query is not available", async () => {
    const anthropic = createAnthropicMock();
    const notion = createNotionV5Mock();

    const app = createApp({
      anthropic,
      notion,
      config: {
        notionDatabaseId: "database-id",
        claudeModel: "claude-test-model",
        allowedOrigin: "http://localhost:5173",
      },
    });

    await request(app)
      .post("/api/moji-to-notion")
      .send({ mojiText: "退く②⓪\nどく\n让开；躲开；退让" })
      .expect(200);

    expect(notion.databases.retrieve).toHaveBeenCalledWith({ database_id: "database-id" });
    expect(notion.dataSources.query).toHaveBeenCalledWith({
      data_source_id: "data-source-id",
      filter: { property: "單字", title: { equals: "退く" } },
      page_size: 1,
    });
    expect(notion.pages.create).toHaveBeenCalledOnce();
  });

  it("returns 409 and skips page creation when the Claude-parsed vocab already exists in Notion", async () => {
    const anthropic = createAnthropicMock();
    const notion = createNotionMock({
      results: [
        {
          id: "existing-page-id",
          url: "https://notion.so/existing-page-id",
        },
      ],
    });

    const app = createApp({
      anthropic,
      notion,
      config: {
        notionDatabaseId: "database-id",
        claudeModel: "claude-test-model",
        allowedOrigin: "http://localhost:5173",
      },
    });

    const res = await request(app)
      .post("/api/moji-to-notion")
      .send({ mojiText: "退く②⓪\nどく\n让开；躲开；退让" })
      .expect(409);

    expect(res.body).toEqual({
      ok: false,
      duplicate: true,
      message: "此單字已存在於 Notion",
      notionUrl: "https://notion.so/existing-page-id",
    });
    expect(anthropic.messages.create).toHaveBeenCalledOnce();
    expect(notion.databases.query).toHaveBeenCalledWith({
      database_id: "database-id",
      filter: { property: "單字", title: { equals: "退く" } },
      page_size: 1,
    });
    expect(notion.pages.create).not.toHaveBeenCalled();
  });

  it("returns 400 when mojiText is missing", async () => {
    const app = createApp({
      anthropic: { messages: { create: vi.fn() } },
      notion: createNotionMock(),
      config: { notionDatabaseId: "database-id", claudeModel: "claude-test-model" },
    });

    const res = await request(app).post("/api/moji-to-notion").send({}).expect(400);
    expect(res.body.ok).toBe(false);
  });
});
