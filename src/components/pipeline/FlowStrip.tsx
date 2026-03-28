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
  'unknown':           '👤',
};

function normalizeActor(actor: string): string {
  if (actor === 'main') return 'sokrat';
  if (actor === 'brainstorm') return 'brainstorm-claude';
  return actor;
}

function getEmoji(actor: string): string {
  return AGENT_EMOJI[actor] ?? AGENT_EMOJI['unknown'];
}

interface FlowStripProps {
  actors: string[];
  maxVisible?: number;
}

export default function FlowStrip({ actors, maxVisible = 5 }: FlowStripProps) {
  if (!actors || actors.length === 0) return null;

  const normalized = actors.map(normalizeActor);
  const overflow = normalized.length > maxVisible ? normalized.length - (maxVisible - 1) : 0;
  const visible = overflow > 0 ? normalized.slice(0, maxVisible - 1) : normalized;

  return (
    <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
      {visible.map((actor, i) => (
        <span key={`${actor}-${i}`} className="flex items-center gap-0.5">
          {i > 0 && (
            <span className="text-text-disabled text-[10px]">→</span>
          )}
          <span
            title={actor}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-overlay border border-border-subtle text-xs"
          >
            {getEmoji(actor)}
          </span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex items-center gap-0.5">
          <span className="text-text-disabled text-[10px]">→</span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-overlay border border-border-subtle text-xs text-text-secondary font-mono">
            +{overflow}
          </span>
        </span>
      )}
    </div>
  );
}
