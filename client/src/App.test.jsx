import { StrictMode } from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App.jsx";

const successPayload = {
  ok: true,
  data: {
    vocab: "退く",
    kana: "どく",
    pos: "自動詞・五段",
    meaning: "讓開",
    grammar: "ます形：退きます",
    example_jp: "ちょっとどいてくれ。",
    example_zh: "請讓開一下。",
    notes: "口語常用。",
    jlpt_level: "N3",
    difficulty: "3",
    tags: ["日常", "口語"],
    collocations: "席をどく",
    nuance: "口語感強。",
    common_mistakes: "不要寫成簡體。",
    memory_hook: "どいて＝讓一下。",
    review_status: "New",
    next_review: "2026-06-01",
    conjugations: "退きます、退いて",
    related_words: "退かす（どかす）",
    synonyms: "下がる",
    antonyms: "進む",
    all_examples: "1. ちょっとどいてくれ。— 請讓開一下。",
    raw_moji_text: "退く②⓪",
    kanji_readings: "退く（どく）",
  },
  notionPageId: "page-id",
  notionUrl: "https://notion.so/page-id",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const dashboardPayload = {
  ok: true,
  total: 63,
  jlpt: { N5: 12, N4: 8, N3: 25, N2: 10, N1: 3, Unknown: 5 },
  difficulty: { "1": 5, "2": 12, "3": 18, "4": 8, "5": 3 },
  dueToday: [
    {
      vocab: "退く",
      kana: "どく",
      jlpt_level: "N3",
      meaning: "讓開；退讓",
      example_jp: "ちょっとどいてくれ。",
      example_zh: "請讓開一下。",
      next_review: "2026-06-01",
      notionPageId: "doku-page-id",
      notionUrl: "https://notion.so/doku",
      currentInterval: 5,
    },
  ],
  recentlyAdded: [
    { vocab: "猫", kana: "ねこ", jlpt_level: "N5", difficulty: "1", notionUrl: "https://notion.so/neko" },
  ],
};

const todayTasksPayload = {
  ok: true,
  today: "2026-05-28",
  summary: { dueReviewCount: 2, weakItemCount: 1, suggestedQuizCount: 2 },
  tasks: [
    {
      id: "review-due",
      type: "review",
      title: "完成今日待複習",
      description: "先完成到期的 New / Reviewing 卡片。",
      priority: "high",
      count: 2,
      items: [
        { vocab: "退く", kana: "どく", meaning: "讓開；退讓", example_jp: "ちょっとどいてくれ。", example_zh: "請讓開一下。", notionPageId: "doku-page-id", currentInterval: 5 },
        { vocab: "猫", kana: "ねこ", meaning: "貓", notionPageId: "neko-page-id", currentInterval: 3 },
      ],
    },
    {
      id: "weakness-focus",
      type: "weakness",
      title: "優先處理生疏單字",
      description: "把 Again 次數高的單字放在今天前段。",
      priority: "medium",
      count: 1,
      items: [
        { vocab: "退く", kana: "どく", meaning: "讓開；退讓", lapseCount: 2, reviewCount: 7, riskLevel: "high", suggestedAction: "加入今日任務並用 Claude 小測驗重新檢查語感" },
      ],
    },
    {
      id: "claude-quiz",
      type: "quiz",
      title: "Claude 小測驗",
      description: "用今天到期或生疏單字產生一題語感/例句理解測驗。",
      priority: "medium",
      count: 2,
      items: [
        { vocab: "退く", kana: "どく", meaning: "讓開；退讓", example_jp: "ちょっとどいてくれ。", example_zh: "請讓開一下。" },
        { vocab: "猫", kana: "ねこ", meaning: "貓" },
      ],
    },
  ],
};

const weaknessPayload = {
  ok: true,
  summary: { highRiskCount: 1, totalLapses: 2, averageLapsesPerReviewedItem: 2 },
  recommendations: [
    "先處理生疏次數最高的 1 個單字，再做 Claude 小測驗確認是否真正理解。",
    "Again/生疏 的單字會回到 3 天間隔；若連續生疏，建議重寫例句或補記憶法。",
  ],
  items: [
    { vocab: "退く", kana: "どく", meaning: "讓開；退讓", lapseCount: 2, reviewCount: 7, riskLevel: "high", suggestedAction: "加入今日任務並用 Claude 小測驗重新檢查語感" },
  ],
};

const quizPayload = {
  ok: true,
  quiz: {
    question: "「退く（どく）」在這句中最接近哪個意思？",
    choices: ["讓開", "前進", "購買", "書寫"],
    answer: "讓開",
    explanation: "「どく」常表示從某處讓出空間。",
    target_vocab: "退く",
  },
};

describe("App", () => {
  it("renders today task mode with weakness analysis and generates a Claude quiz", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith("/api/today-tasks")) {
        return { ok: true, json: async () => todayTasksPayload };
      }
      if (String(url).endsWith("/api/weakness-report")) {
        return { ok: true, json: async () => weaknessPayload };
      }
      if (String(url).endsWith("/api/quiz/generate")) {
        expect(JSON.parse(options.body).items.map((item) => item.vocab)).toEqual(["退く", "猫"]);
        return { ok: true, json: async () => quizPayload };
      }
      return { ok: true, json: async () => dashboardPayload };
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "今日任務" }));

    expect(await screen.findByText("今日任務模式")).toBeInTheDocument();
    expect(screen.getByText("完成今日待複習")).toBeInTheDocument();
    expect(screen.getByText("今日待複習：2")).toBeInTheDocument();
    expect(screen.getByText("錯題本 / 生疏分析")).toBeInTheDocument();
    expect(screen.getByText("總生疏次數：2")).toBeInTheDocument();
    expect(screen.getByText("加入今日任務並用 Claude 小測驗重新檢查語感")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "產生 Claude 小測驗" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/quiz/generate",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText("「退く（どく）」在這句中最接近哪個意思？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "讓開" }));
    expect(screen.getByText("答對了！「讓開」")).toBeInTheDocument();
    expect(screen.getByText("「どく」常表示從某處讓出空間。")).toBeInTheDocument();
  });

  it("previews Claude analysis, allows editing, and saves edited data to Notion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith("/api/moji-preview")) {
        return { ok: true, json: async () => ({ ok: true, mode: "preview", data: successPayload.data }) };
      }
      if (String(url).endsWith("/api/vocab-to-notion")) {
        return { ok: true, json: async () => ({ ...successPayload, data: JSON.parse(options.body).data }) };
      }
      return { ok: true, json: async () => dashboardPayload };
    });

    render(<App />);

    const textarea = screen.getByPlaceholderText("請貼上從 Moji 辭書複製的完整內容...");
    fireEvent.change(textarea, { target: { value: "退く②⓪\nどく" } });
    fireEvent.click(screen.getByRole("button", { name: "只分析預覽" }));

    const meaningInput = await screen.findByLabelText("編輯 中文意思");
    expect(screen.getByText("預覽待確認")).toBeInTheDocument();
    fireEvent.change(meaningInput, { target: { value: "讓開；退讓（人工校正）" } });
    fireEvent.click(screen.getByRole("button", { name: "確認儲存到 Notion" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/vocab-to-notion",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("讓開；退讓（人工校正）"),
      }),
    ));
    expect(await screen.findByText("已儲存到 Notion ✓")).toBeInTheDocument();
  });

  it("shows Notion schema health status and missing property hints", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/api/notion-schema-health")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            healthy: false,
            checked: 29,
            missing: [{ property: "學習筆記", expectedType: "rich_text" }],
            typeMismatches: [{ property: "詞性", expectedType: "select", actualType: "rich_text" }],
          }),
        };
      }
      return { ok: true, json: async () => dashboardPayload };
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "檢查 Notion 欄位" }));

    expect(await screen.findByText("Schema 需要調整" )).toBeInTheDocument();
    expect(screen.getByText("缺少欄位：學習筆記（rich_text）")).toBeInTheDocument();
    expect(screen.getByText("型別不符：詞性 應為 select，目前是 rich_text")).toBeInTheDocument();
  });

  it("submits batch entries split by separators and renders import summary", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/api/batch-moji-to-notion")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            summary: { total: 2, created: 1, duplicate: 1, failed: 0 },
            items: [
              { index: 0, status: "created", vocab: "退く", notionUrl: "https://notion.so/doku" },
              { index: 1, status: "duplicate", vocab: "猫", notionUrl: "https://notion.so/neko" },
            ],
          }),
        };
      }
      return { ok: true, json: async () => dashboardPayload };
    });

    render(<App />);
    const batchTextarea = screen.getByPlaceholderText("每個單字以 --- 分隔，可一次貼上多筆 Moji 內容...");
    fireEvent.change(batchTextarea, { target: { value: "退く②⓪\nどく\n---\n猫\nねこ" } });
    fireEvent.click(screen.getByRole("button", { name: "開始批次匯入" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/batch-moji-to-notion",
      expect.objectContaining({ body: JSON.stringify({ entries: ["退く②⓪\nどく", "猫\nねこ"] }) }),
    ));
    expect(await screen.findByText("批次完成：成功 1、重複 1、失敗 0 / 共 2 筆")).toBeInTheDocument();
    expect(screen.getByText("退く：created")).toBeInTheDocument();
    expect(screen.getByText("猫：duplicate")).toBeInTheDocument();
  });

  it("refreshes dashboard stats on demand", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => dashboardPayload });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "儀表板" }));
    expect(await screen.findByText("學習數據儀表板")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新整理儀表板" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("starts with an empty Moji textarea and disables submit until the user pastes content", () => {
    render(<App />);

    const textarea = screen.getByPlaceholderText("請貼上從 Moji 辭書複製的完整內容...");
    const submitButton = screen.getByRole("button", { name: "分析完整頁面並新增到 Notion" });

    expect(textarea).toHaveValue("");
    expect(textarea).not.toHaveValue(expect.stringContaining("退く②⓪"));
    expect(submitButton).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "勉強\nべんきょう" } });

    expect(submitButton).toBeEnabled();
  });

  it("loads and renders the learning dashboard when switching to the dashboard tab", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => dashboardPayload,
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "儀表板" }));

    expect(await screen.findByText("學習數據儀表板")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:3001/api/dashboard-stats");
    expect(screen.getByText("總單字數")).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
    expect(screen.getByText("今日待複習數量")).toBeInTheDocument();
    expect(screen.getByText("退く")).toBeInTheDocument();
    expect(screen.getByText("最近新增單字")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "開啟 Notion" })).toHaveAttribute("href", "https://notion.so/doku");
  });

  it("deduplicates dashboard stats requests under React StrictMode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => dashboardPayload,
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "儀表板" }));

    expect(await screen.findByText("學習數據儀表板")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("starts review mode, supports TTS and keyboard shortcuts, submits Good result, and removes the reviewed card", async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: speakMock, cancel: cancelMock },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith("/api/review")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: "good",
            newInterval: 13,
            newStatus: "Reviewing",
            nextReviewDate: "2026-06-10",
          }),
        };
      }

      return {
        ok: true,
        json: async () => dashboardPayload,
      };
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "儀表板" }));

    fireEvent.click(await screen.findByRole("button", { name: "開始複習" }));
    fireEvent.click(screen.getByRole("button", { name: "播放 退く 發音" }));
    expect(speakMock).toHaveBeenCalledWith(expect.objectContaining({ text: "退く", lang: "ja-JP" }));
    expect(screen.getByText("答案隱藏中：？？？？")).toBeInTheDocument();
    expect(screen.queryByText("意思：讓開；退讓")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("意思：讓開；退讓")).toBeInTheDocument();
    expect(screen.getByText("例句：ちょっとどいてくれ。")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "2" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/review",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ notionPageId: "doku-page-id", result: "good", currentInterval: 5 }),
      }),
    ));
    expect(await screen.findByText("✓ 已記錄：一般，下次複習 13 天後（2026-06-10）")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("🎉 今日所有單字複習完成！")).toBeInTheDocument());
  });

  it("clears the textarea after a successful save, keeps the saved result visible, and pronounces vocab", async () => {
    const speakMock = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: speakMock, cancel: vi.fn() },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => successPayload,
    });

    render(<App />);

    const textarea = screen.getByPlaceholderText("請貼上從 Moji 辭書複製的完整內容...");
    fireEvent.change(textarea, { target: { value: "退く②⓪\nどく" } });
    fireEvent.click(screen.getByRole("button", { name: "分析完整頁面並新增到 Notion" }));

    await waitFor(() => expect(textarea).toHaveValue(""));
    expect(screen.getByText("已儲存到 Notion ✓")).toBeInTheDocument();
    expect(screen.getByText("輸入框已清空，可貼入下一個單字")).toBeInTheDocument();
    expect(screen.getByText("退く")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "播放 退く 發音" }));
    expect(speakMock).toHaveBeenCalledWith(expect.objectContaining({ text: "退く", lang: "ja-JP" }));
    expect(screen.getByRole("link", { name: "開啟 Notion 頁面" })).toHaveAttribute("href", "https://notion.so/page-id");
  });

  it("shows a yellow duplicate warning with a link and does not show a red error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        ok: false,
        duplicate: true,
        message: "此單字已存在於 Notion",
        notionUrl: "https://notion.so/existing-page-id",
      }),
    });

    render(<App />);

    const textarea = screen.getByPlaceholderText("請貼上從 Moji 辭書複製的完整內容...");
    fireEvent.change(textarea, { target: { value: "退く②⓪\nどく" } });
    fireEvent.click(screen.getByRole("button", { name: "分析完整頁面並新增到 Notion" }));

    const warning = await screen.findByText("此單字已存在於 Notion");
    expect(warning.closest(".alert")).toHaveClass("warning");
    expect(screen.queryByText("發生未知錯誤")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "開啟既有 Notion 頁面" })).toHaveAttribute(
      "href",
      "https://notion.so/existing-page-id",
    );
    expect(textarea).toHaveValue("退く②⓪\nどく");
  });
});
