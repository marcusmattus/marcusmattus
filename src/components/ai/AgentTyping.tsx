export default function AgentTyping() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gami-purple flex items-center justify-center shadow-brutal-sm flex-shrink-0">
        <span className="text-sm">🤖</span>
      </div>
      <div className="bg-gami-surface border border-gami-border px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-gami-accent inline-block animate-bounce-dot"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  )
}
