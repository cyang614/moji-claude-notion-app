import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

function notionPage({ vocab, kana = "", jlpt = "Unknown", difficulty = "3", nextReview = null, url = "https://notion.so/page" }) {
  return {
    id: `${vocab}-id`,
    url,
    properties: {
      單字: { title: [{ plain_text: vocab, text: { content: vocab } }] },
      讀音: { rich_text: kana ? [{ plain_text: kana, text: { content: kana } }] : [] },
      "JLPT 等級": { select: jlpt ? { name: jlpt } : null },
      難度: { select: difficulty ? { name: difficulty } : null },
      下次複習日: { date: nextReview ? { start: nextReview } : null },
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

function createNotionMock(queryResponse = { results: [] }) {
  return {
    databases: {
      query: vi.fn().mockResolvedValue(queryResponse),
    },
    pages: {
      create: vi.fn().mockResolvedValue({
        id: "notion-page-id",
        url: "https://notion.so/notion-page-id",
      }),
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
      create: vi.fn().mockResolvedValue({
        id: "notion-page-id",
        url: "https://notion.so/notion-page-id",
      }),
    },
  };
}

function createDashboardNotionMock() {
  const pages = [
    notionPage({ vocab: "猫", kana: "ねこ", jlpt: "N5", difficulty: "1", nextReview: "2026-05-27", url: "https://notion.so/neko" }),
    notionPage({ vocab: "退く", kana: "どく", jlpt: "N3", difficulty: "3", nextReview: "2026-05-26", url: "https://notion.so/doku" }),
    notionPage({ vocab: "概念", kana: "がいねん", jlpt: "N2", difficulty: "4", nextReview: "2026-06-01", url: "https://notion.so/gainen" }),
  ];

  function selectName(payload, property) {
    return payload.filter?.select?.equals
      ?? payload.filter?.and?.find((item) => item.property === property)?.select?.equals;
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
        const jlpt = payload.filter?.property === "JLPT 等級" ? payload.filter.select.equals : null;
        const difficulty = payload.filter?.property === "難度" ? payload.filter.select.equals : null;
        const status = selectName(payload, "複習狀態");
        const isDue = payload.filter?.and?.some((item) => item.property === "下次複習日");

        if (jlpt) return { results: pages.filter((page) => page.properties["JLPT 等級"].select?.name === jlpt) };
        if (difficulty) return { results: pages.filter((page) => page.properties["難度"].select?.name === difficulty) };
        if (status === "New" && isDue) return { results: pages.slice(0, 2) };
        if (payload.sorts) return { results: pages.slice().reverse() };
        return { results: pages };
      }),
    },
    pages: { create: vi.fn() },
  };
}

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
      total: 3,
      jlpt: { N5: 1, N4: 0, N3: 1, N2: 1, N1: 0, Unknown: 0 },
      difficulty: { "1": 1, "2": 0, "3": 1, "4": 1, "5": 0 },
    });
    expect(res.body.dueToday).toEqual([
      { vocab: "猫", kana: "ねこ", jlpt_level: "N5", next_review: "2026-05-27", notionUrl: "https://notion.so/neko" },
      { vocab: "退く", kana: "どく", jlpt_level: "N3", next_review: "2026-05-26", notionUrl: "https://notion.so/doku" },
    ]);
    expect(res.body.recentlyAdded[0]).toEqual({
      vocab: "概念",
      kana: "がいねん",
      jlpt_level: "N2",
      difficulty: "4",
      notionUrl: "https://notion.so/gainen",
    });
    expect(notion.databases.retrieve).toHaveBeenCalledWith({ database_id: "database-id" });
    expect(notion.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({
      data_source_id: "data-source-id",
      filter: { property: "JLPT 等級", select: { equals: "N5" } },
      page_size: 100,
    }));
    expect(notion.dataSources.query).toHaveBeenCalledWith(expect.objectContaining({
      data_source_id: "data-source-id",
      page_size: 20,
      filter: expect.objectContaining({ and: expect.any(Array) }),
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
