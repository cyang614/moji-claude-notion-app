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

describe("App", () => {
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
