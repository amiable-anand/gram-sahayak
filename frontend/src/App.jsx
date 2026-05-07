import { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import UploadCard from "./components/UploadCard";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const SUPPORTED_LANGUAGES = ["English", "Hindi", "Marathi"];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadNote, setUploadNote] = useState("");

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
    <div className="min-h-screen bg-hero-radial">
      <header className="sticky top-0 z-10 border-b border-white/40 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow">
                <span className="text-lg font-black">GS</span>
              </div>
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700">
                  Gram Sahayak
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    RAG • Azure
                  </span>
                </p>
                <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  Village Helper for Welfare Schemes
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Upload PDFs, ask in simple language, and get answers in English, Hindi, or Marathi.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end sm:justify-end">
              <div className="min-w-[220px]">
                <label htmlFor="language" className="mb-1 block text-xs font-medium text-slate-600">
                  Response language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <a
                href="https://oai.azure.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                OpenAI Studio
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-4">
          <UploadCard
            apiBaseUrl={API_BASE_URL}
            onUploaded={({ filename }) => {
              setUploadNote(`Uploaded ${filename}. Indexing will start automatically. Ask questions in 1–3 minutes.`);
            }}
          />
          {uploadNote && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
              <p className="font-semibold text-slate-900">Upload status</p>
              <p className="mt-1 text-slate-600">{uploadNote}</p>
            </div>
          )}
          <div className="rounded-2xl border border-white/50 bg-white/70 px-5 py-4 text-xs text-slate-700 shadow-sm backdrop-blur">
            <p className="font-semibold text-slate-900">Privacy & safety</p>
            <p className="mt-1">
              PDFs are stored in your Azure Storage and indexed into your Azure AI Search. The assistant answers only from
              uploaded documents.
            </p>
            <div className="mt-3 grid gap-2 text-[11px] text-slate-600">
              <p>
                - <span className="font-semibold text-slate-700">Tip</span>: Ask the same question in Marathi/Hindi—backend
                translates for retrieval and responds in your chosen language.
              </p>
              <p>
                - <span className="font-semibold text-slate-700">Note</span>: If a PDF isn’t indexed yet, wait 1–3 minutes
                after upload.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <ChatWindow messages={messages} loading={loading} />

          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur">
            <label htmlFor="query" className="mb-2 block text-sm font-semibold text-slate-800">
              Ask a question
            </label>
            <textarea
              id="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Example: Who is eligible and what documents are required?"
              className="h-28 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Tip: Upload a PDF first. Answers come only from indexed documents.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
              >
                {loading ? "Thinking…" : "Ask"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>

          <footer className="pb-4 text-center text-xs text-slate-500">
            Built for low-cost Azure MVP: Static Web Apps + App Service + Functions + AI Search + Azure OpenAI
          </footer>
        </div>
      </main>
    </div>
  );
}
