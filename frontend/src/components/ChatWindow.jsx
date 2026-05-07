import { useEffect, useMemo, useRef } from "react";

function initials(role) {
  return role === "user" ? "You" : "GS";
}

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[92%] items-end gap-2 sm:max-w-[85%] ${isUser ? "flex-row-reverse" : ""}`}>
        <div
          className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold shadow-sm ${
            isUser ? "bg-brand-600 text-white" : "bg-white text-slate-700"
          }`}
          aria-hidden="true"
        >
          {initials(role)}
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow ${
            isUser ? "bg-brand-600 text-white" : "bg-white text-slate-800"
          }`}
        >
          <pre className="whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, loading }) {
  const bottomRef = useRef(null);
  const empty = useMemo(() => messages.length === 0, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <section
      aria-live="polite"
      className="flex h-[58vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
    >
      {empty ? (
        <div className="grid h-full place-items-center">
          <div className="max-w-md text-center">
            <p className="text-base font-semibold text-slate-900">Ask in simple language</p>
            <p className="mt-2 text-sm text-slate-600">
              Upload a scheme PDF, then ask questions like eligibility, benefits, documents required, and how to apply.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Examples</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Who can apply for this scheme?</li>
                <li>How much money will I get?</li>
                <li>Which documents are required?</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
        ))
      )}

      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow">
            Thinking…
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </section>
  );
}
