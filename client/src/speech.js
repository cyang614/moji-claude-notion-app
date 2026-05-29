export function speakJapanese(text) {
  const content = String(text || "").trim();
  if (!content || typeof window === "undefined" || !window.speechSynthesis) {
    return false;
  }

  const Utterance = window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  const utterance = Utterance ? new Utterance(content) : { text: content };
  utterance.lang = "ja-JP";
  utterance.rate = 0.9;

  window.speechSynthesis.cancel?.();
  window.speechSynthesis.speak(utterance);
  return true;
}
