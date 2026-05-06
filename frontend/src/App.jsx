import { useState } from "react";
import ChatWindow from "./components/ChatWindow";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const SUPPORTED_LANGUAGES = ["English", "Hindi", "Marathi"];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || loading) {
      return;
    }

    setError("");
    setMessages((prev) => [...prev, { role: "user", content: trimmedQuery }]);
    setQuery("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: trimmedQuery,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (requestError) {
      setError("Failed to get an answer. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I could not process your request right now. Please try again in a moment.",
        },
      ]);
      console.error(requestError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <header className="rounded-xl bg-brand-700 px-5 py-6 text-white shadow">
        <h1 className="text-2xl font-semibold">Gram Sahayak</h1>
        <p className="mt-1 text-sm text-brand-100">
          Ask welfare scheme questions in simple language and get answers in your preferred language.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="language" className="mb-2 block text-sm font-medium text-slate-700">
          Response language
        </label>
        <select
          id="language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-60"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      <ChatWindow messages={messages} loading={loading} />

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="query" className="mb-2 block text-sm font-medium text-slate-700">
          Your question
        </label>
        <textarea
          id="query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. Am I eligible for PM-KISAN scheme?"
          className="h-28 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          required
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Answers are generated from uploaded scheme documents only.</p>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "Sending..." : "Ask"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
