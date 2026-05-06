function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow ${
          isUser ? "bg-brand-600 text-white" : "bg-white text-slate-800"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, loading }) {
  return (
    <section
      aria-live="polite"
      className="flex h-[60vh] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500">
          Ask your question about any government welfare scheme.
        </p>
      ) : (
        messages.map((message, index) => (
          <MessageBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
        ))
      )}

      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow">
            Thinking...
          </div>
        </div>
      )}
    </section>
  );
}
