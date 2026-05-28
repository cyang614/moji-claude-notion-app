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

describe("App", () => {
  it("clears the textarea after a successful save and keeps the saved result visible", async () => {
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
