const AGENT_EMOJI: Record<string, string> = {
  'sokrat':            '🦉',
  'archimedes':        '⚙️',
  'platon':            '🏛️',
  'leo':               '🎨',
  'aristotle':         '📚',
  'herodotus':         '📜',
  'hephaestus':        '⚒️',
  'brainstorm-claude': '🧠',
  'brainstorm-codex':  '💡',
  'owner':             '💬',
  'unknown':           '👤',
};

function getEmoji(actor: string): string {
  return AGENT_EMOJI[actor] ?? AGENT_EMOJI['unknown'];
}

function relativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

interface Comment {
  actor: string;
  body: string;
  timestamp: string;
}

interface CommentThreadProps {
  comments: Comment[];
}

export function CommentThread({ comments }: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <p className="text-text-disabled text-sm italic">No comments yet</p>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto space-y-3">
      {comments.map((comment, i) => (
        <div key={i} className="flex gap-2 text-sm">
          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-bg-overlay border border-border-subtle text-xs">
            {getEmoji(comment.actor)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-text-primary">{comment.actor}</span>
              <span className="text-xs text-text-tertiary">{relativeTime(comment.timestamp)}</span>
            </div>
            <p className="text-text-secondary mt-0.5 break-words">{comment.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
