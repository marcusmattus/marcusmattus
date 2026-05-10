import ToolCallBadge from './ToolCallBadge'

interface ToolCall {
  name: string
  result?: string
}

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  timestamp: string
}

export default function ChatBubble({ role, content, toolCalls, timestamp }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex items-start gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 flex items-center justify-center shadow-brutal-sm flex-shrink-0 text-sm ${
          isUser ? 'bg-gami-purple' : 'bg-gami-surface border border-gami-border'
        }`}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Message column */}
      <div className={`flex flex-col gap-1.5 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Tool call badges (assistant only, shown above message) */}
        {!isUser && toolCalls && toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {toolCalls.map((tc, i) => (
              <ToolCallBadge key={i} name={tc.name} result={tc.result} />
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-3 border text-sm leading-relaxed ${
            isUser
              ? 'bg-gami-purple border-gami-purple text-white'
              : 'bg-gami-surface border-gami-border text-white'
          }`}
        >
          {/* Very basic markdown: **bold** */}
          {content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
            part.startsWith('**') ? (
              <strong key={i} className="font-semibold text-gami-green">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>

        {/* Timestamp */}
        <span className="font-mono text-[10px] text-gami-muted">{timestamp}</span>
      </div>
    </div>
  )
}
